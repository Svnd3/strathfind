import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputSubmitEditingEventData,
} from 'react-native';
import { MapPin } from 'lucide-react-native';

import { focusRing, layout, palette, radius, raisedShadow, spacing } from '@/constants/design';
import {
  createGooglePlacesSessionToken,
  fetchGoogleCampusLocations,
  hasGoogleCampusLocations,
  searchCampusLocations,
  type CampusLocationSuggestion,
} from '@/lib/campus-locations';

import { TextField, type TextFieldProps } from './fields';
import { AppText } from './typography';

export interface CampusLocationFieldProps
  extends Omit<
    TextFieldProps,
    'label' | 'leading' | 'onChangeText' | 'onKeyPress' | 'onSubmitEditing' | 'trailing' | 'value'
  > {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  maxSuggestions?: number;
  onSelectSuggestion?: (suggestion: CampusLocationSuggestion) => void;
  onKeyPress?: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  onSubmitEditing?: (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void;
}

function suggestionKey(suggestion: CampusLocationSuggestion) {
  return `${suggestion.label}|${suggestion.detail ?? ''}`.toLocaleLowerCase('en-KE');
}

/**
 * Controlled location input with accessible local suggestions and optional
 * Google Places enrichment. Free-form text always remains valid.
 */
export function CampusLocationField({
  value,
  onChangeText,
  label = 'Location',
  maxSuggestions = 6,
  onSelectSuggestion,
  onFocus,
  onBlur,
  onKeyPress,
  onSubmitEditing,
  nativeID,
  placeholder = 'Start typing a campus place',
  ...props
}: CampusLocationFieldProps) {
  const generatedId = useId();
  const inputId = nativeID ?? `campus-location-${generatedId}`;
  const listId = `${inputId}-suggestions`;
  const safeLimit = Math.max(1, Math.min(maxSuggestions, 10));
  const googleEnabled = hasGoogleCampusLocations();
  const sessionToken = useRef(createGooglePlacesSessionToken());
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [googleResult, setGoogleResult] = useState<{
    loading: boolean;
    query: string;
    suggestions: CampusLocationSuggestion[];
  }>({ loading: false, query: '', suggestions: [] });

  const localSuggestions = useMemo(
    () => searchCampusLocations(value, safeLimit),
    [safeLimit, value],
  );

  useEffect(() => {
    const query = value.trim();
    if (!open || !googleEnabled || query.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setGoogleResult({ loading: true, query, suggestions: [] });
      try {
        const suggestions = await fetchGoogleCampusLocations(query, {
          limit: safeLimit,
          sessionToken: sessionToken.current,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setGoogleResult({ loading: false, query, suggestions });
        }
      } catch {
        if (!controller.signal.aborted) {
          setGoogleResult({ loading: false, query, suggestions: [] });
        }
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [googleEnabled, open, safeLimit, value]);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const currentQuery = value.trim();
  const googleSuggestions = useMemo(
    () => (googleResult.query === currentQuery ? googleResult.suggestions : []),
    [currentQuery, googleResult.query, googleResult.suggestions],
  );
  const loading =
    open && googleResult.query === currentQuery && googleResult.loading;

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const merged: CampusLocationSuggestion[] = [];

    for (const suggestion of [...localSuggestions, ...googleSuggestions]) {
      const key = suggestionKey(suggestion);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(suggestion);
      if (merged.length === safeLimit) break;
    }

    return merged;
  }, [googleSuggestions, localSuggestions, safeLimit]);

  const resolvedActiveIndex = suggestions.length
    ? Math.min(activeIndex, suggestions.length - 1)
    : -1;

  const selectSuggestion = (suggestion: CampusLocationSuggestion) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    onChangeText(suggestion.label);
    onSelectSuggestion?.(suggestion);
    setOpen(false);
    setActiveIndex(-1);
    sessionToken.current = createGooglePlacesSessionToken();
  };

  const handleKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const key = event.nativeEvent.key;

    if (open && suggestions.length) {
      if (key === 'ArrowDown') {
        event.preventDefault?.();
        setActiveIndex((current) => (current + 1) % suggestions.length);
        return;
      }
      if (key === 'ArrowUp') {
        event.preventDefault?.();
        setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
        return;
      }
      if (key === 'Enter' && resolvedActiveIndex >= 0) {
        event.preventDefault?.();
        selectSuggestion(suggestions[resolvedActiveIndex]);
        return;
      }
    }

    if (key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    onKeyPress?.(event);
  };

  const handleSubmit = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    if (open && resolvedActiveIndex >= 0 && suggestions[resolvedActiveIndex]) {
      selectSuggestion(suggestions[resolvedActiveIndex]);
      return;
    }
    onSubmitEditing?.(event);
  };

  const showSuggestions = open && suggestions.length > 0;
  const activeOptionId = resolvedActiveIndex >= 0 ? `${listId}-${resolvedActiveIndex}` : undefined;

  return (
    <View style={styles.root}>
      <TextField
        {...props}
        nativeID={inputId}
        label={label}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        accessibilityRole="combobox"
        aria-autocomplete="list"
        aria-controls={showSuggestions ? listId : undefined}
        aria-expanded={showSuggestions}
        aria-activedescendant={activeOptionId}
        leading={<MapPin aria-hidden color={palette.muted} size={20} strokeWidth={2.1} />}
        trailing={
          loading ? (
            <ActivityIndicator accessibilityLabel="Finding campus places" color={palette.wine} size="small" />
          ) : undefined
        }
        onChangeText={(nextValue) => {
          onChangeText(nextValue);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={(event) => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          blurTimer.current = setTimeout(() => {
            setOpen(false);
            setActiveIndex(-1);
          }, 180);
          onBlur?.(event);
        }}
        onKeyPress={handleKeyPress}
        onSubmitEditing={handleSubmit}
      />

      {showSuggestions ? (
        <View
          nativeID={listId}
          accessibilityLabel="Campus location suggestions"
          role={Platform.OS === 'web' ? ('listbox' as 'list') : 'list'}
          style={styles.suggestionList}
        >
          {suggestions.map((suggestion, index) => {
            const active = index === resolvedActiveIndex;
            return (
              <Pressable
                key={suggestion.id}
                nativeID={`${listId}-${index}`}
                accessibilityLabel={
                  suggestion.detail ? `${suggestion.label}, ${suggestion.detail}` : suggestion.label
                }
                role={Platform.OS === 'web' ? 'option' : 'listitem'}
                accessibilityState={{ selected: active }}
                onFocus={() => setActiveIndex(index)}
                onHoverIn={() => setActiveIndex(index)}
                onPress={() => selectSuggestion(suggestion)}
                style={({ pressed }) => [
                  styles.suggestion,
                  index < suggestions.length - 1 && styles.suggestionDivider,
                  (active || pressed) && styles.suggestionActive,
                  active && focusRing(true),
                ]}
              >
                <View style={styles.pin}>
                  <MapPin aria-hidden color={palette.wine} size={17} strokeWidth={2.2} />
                </View>
                <View style={styles.suggestionCopy}>
                  <AppText numberOfLines={1} variant="bodyStrong">
                    {suggestion.label}
                  </AppText>
                  {suggestion.detail ? (
                    <AppText numberOfLines={1} variant="support" color={palette.muted}>
                      {suggestion.detail}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}

          {googleSuggestions.length ? (
            <AppText
              accessibilityLiveRegion="polite"
              variant="micro"
              color={palette.muted}
              style={styles.attribution}
            >
              SUGGESTIONS BY GOOGLE MAPS
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    zIndex: 10,
  },
  suggestionList: {
    marginTop: spacing.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.lineSoft,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceStrong,
    ...raisedShadow('sm'),
  },
  suggestion: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: palette.surfaceStrong,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : {}),
  },
  suggestionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: palette.lineSoft,
  },
  suggestionActive: {
    backgroundColor: palette.wineSoft,
  },
  pin: {
    width: 34,
    height: 34,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: palette.wineSoft,
  },
  suggestionCopy: {
    flex: 1,
    minWidth: 0,
  },
  attribution: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: palette.lineSoft,
    textAlign: 'right',
  },
});

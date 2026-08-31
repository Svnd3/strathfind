# StrathFind validation survey

This is a short, neutral questionnaire for testing whether StrathFind would be useful at Strathmore University. It is designed for Google Forms and should take about two minutes.

## Form title

**StrathFind: Campus Lost-and-Found Survey**

## Form description

StrathFind is a proposed Strathmore University lost-and-found service. People could post or search lost-and-found reports, receive possible-match alerts, answer an ownership check, and arrange a handover at a campus location.

We are testing whether this would be useful and worth piloting at Strathmore. Honest positive or negative feedback is welcome. This survey takes about two minutes and does not ask for your name or contact details. Please do not include names, phone numbers, email addresses, student IDs, or other sensitive information in your answers. Responses will be used only to assess and shape the idea.

## Questions

### 1. What is your relationship to Strathmore?

**Type:** Multiple choice
**Required:** Yes

- Current student
- Current staff or faculty member
- Alumni, visitor, contractor, or other community member
- Not affiliated with Strathmore
- Prefer not to say

### 2. In the past 12 months, which of these has happened to you on campus?

**Type:** Multiple choice
**Required:** Yes

- I lost an item
- I found someone else's item
- Both
- Neither

### 3. Before today, did you know whether Strathmore has a dedicated email address for lost-and-found enquiries?

**Type:** Multiple choice
**Required:** Yes

**Help text:** Please answer honestly—this is about awareness, not a test.

- Yes, and I know the address
- I think there is one, but I do not know the address
- No, I did not know whether one exists
- Not sure

### 4. How effective are the current ways of handling lost property at Strathmore, such as security desks, group chats, or word of mouth?

**Type:** Multiple choice
**Required:** Yes

- Very ineffective
- Somewhat ineffective
- Neither effective nor ineffective
- Somewhat effective
- Very effective
- I have no experience with the current process
- Not sure

### 5. If StrathFind were available, how likely would you be to use it for each of these situations?

**Type:** Multiple-choice grid
**Required:** Yes

**Rows:**

- Report something I lost
- Search for something I lost
- Report something I found

**Columns:**

- Very unlikely
- Unlikely
- Not sure
- Likely
- Very likely

### 6. Considering its possible usefulness and the work needed to maintain it, do you think StrathFind would be worth piloting at Strathmore?

**Type:** Multiple choice
**Required:** Yes

- Definitely not worth piloting
- Probably not worth piloting
- Not sure
- Probably worth piloting
- Definitely worth piloting

### 7. What is the main thing, if anything, that might stop you from using StrathFind?

**Type:** Multiple choice with “Other” enabled
**Required:** Yes

- Privacy or contact details being exposed
- False claims, scams, or unsafe handovers
- Not enough current, accurate listings
- Signing in or reporting would take too much effort
- I prefer existing options such as security desks or group chats
- I do not expect to need it
- Nothing in particular

### 8. If an app like StrathFind existed, what would you want it to include or do?

**Type:** Paragraph
**Required:** No

**Help text:** Please do not include names, contact details, or other sensitive personal information.

## Recommended Google Forms settings

- Do not collect email addresses.
- Do not ask for names, student numbers, phone numbers, or details about specific lost items.
- Do not publish a response summary; open-text answers could contain identifying details.
- Keep question order fixed so the introductory context appears before the recommendation question.
- Use this confirmation message: “Thank you. Your feedback will help decide whether StrathFind is worth piloting at Strathmore.”
- Leave “Limit to 1 response” off for an open forum survey; turning it on requires respondents to sign in. If the form is shared only inside the university, requiring one response may produce cleaner data.
- Share only aggregate results and remove identifying details from any open-text excerpts.

## Short sharing message

> I am evaluating whether StrathFind, a proposed campus lost-and-found service, would be useful at Strathmore. Whether or not you have lost or found something—or would use the service—please share your honest view in this two-minute survey. The form does not ask for your name or contact details: **[FORM LINK]**

## Reading the results

Use question 6 among current students and current staff or faculty as the primary decision measure. Report responses from other groups separately. Also report:

- the percentage who experienced a lost or found item in the past 12 months;
- the percentage who say they know the lost-and-found email address, compared with those who are unsure or unaware;
- the percentage with experience who rate current methods as ineffective, excluding “no experience” and “not sure” responses;
- the percentage who are likely or very likely to use each side of the service; and
- the most common adoption barrier and feature requests.

Treat question 3 as self-reported awareness, not proof that a dedicated address exists or that a respondent remembers it correctly. As of 31 August 2026, Strathmore's official [Security Services page](https://strathmore.edu/security-services/) listed the Student Centre security office, security desks, and the hotline `0733 701 111`, but no dedicated lost-and-found email. The published `info@strathmore.edu` address is the university's general contact address.

Always show the response count and break results down by current students and staff. Forum and group responses are self-selected, so describe them as feedback from respondents rather than as representative of the whole university.

## Create it automatically

The companion Apps Script at `scripts/create-strathfind-google-form.gs` creates the form. In [Google Apps Script](https://script.google.com/):

1. Start a new project.
2. Replace the editor contents with the script.
3. Run `createStrathFindSurvey` once and approve the requested Forms access.
4. Open the execution log and copy the edit and response links.
5. In Google Forms, verify that the responder-access setting permits the audience you plan to invite; a managed Google Workspace account can override the script's publishing setting.

Running the function again creates another form, so run it only once unless you want a duplicate.

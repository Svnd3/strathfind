/**
 * Creates the StrathFind validation questionnaire.
 * Run createStrathFindSurvey once from https://script.google.com/.
 */
function createStrathFindSurvey() {
  const form = FormApp.create('StrathFind: Campus Lost-and-Found Survey', true);

  form
    .setDescription(
      'StrathFind is a proposed Strathmore University lost-and-found service. ' +
        'People could post or search lost-and-found reports, receive possible-match ' +
        'alerts, answer an ownership check, and arrange a handover at a campus location.\n\n' +
        'We are testing whether this would be useful and worth piloting at Strathmore. ' +
        'Honest positive or negative feedback is welcome. This survey takes about ' +
        'two minutes and does not ask for your name or contact details. Please do not ' +
        'include names, phone numbers, email addresses, student IDs, or other sensitive ' +
        'information in your answers. Responses will be used only to assess and shape ' +
        'the idea.'
    )
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setProgressBar(false)
    .setPublishingSummary(false)
    .setShowLinkToRespondAgain(false)
    .setShuffleQuestions(false)
    .setConfirmationMessage(
      'Thank you. Your feedback will help decide whether StrathFind is worth piloting at Strathmore.'
    );

  form
    .addMultipleChoiceItem()
    .setTitle('1. What is your relationship to Strathmore?')
    .setChoiceValues([
      'Current student',
      'Current staff or faculty member',
      'Alumni, visitor, contractor, or other community member',
      'Not affiliated with Strathmore',
      'Prefer not to say',
    ])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle('2. In the past 12 months, which of these has happened to you on campus?')
    .setChoiceValues([
      'I lost an item',
      "I found someone else's item",
      'Both',
      'Neither',
    ])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle(
      '3. Before today, did you know whether Strathmore has a dedicated email address ' +
        'for lost-and-found enquiries?'
    )
    .setHelpText('Please answer honestly—this is about awareness, not a test.')
    .setChoiceValues([
      'Yes, and I know the address',
      'I think there is one, but I do not know the address',
      'No, I did not know whether one exists',
      'Not sure',
    ])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle(
      '4. How effective are the current ways of handling lost property at Strathmore, ' +
        'such as security desks, group chats, or word of mouth?'
    )
    .setChoiceValues([
      'Very ineffective',
      'Somewhat ineffective',
      'Neither effective nor ineffective',
      'Somewhat effective',
      'Very effective',
      'I have no experience with the current process',
      'Not sure',
    ])
    .setRequired(true);

  form
    .addGridItem()
    .setTitle(
      '5. If StrathFind were available, how likely would you be to use it for each of these situations?'
    )
    .setRows([
      'Report something I lost',
      'Search for something I lost',
      'Report something I found',
    ])
    .setColumns(['Very unlikely', 'Unlikely', 'Not sure', 'Likely', 'Very likely'])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle(
      '6. Considering its possible usefulness and the work needed to maintain it, ' +
        'do you think StrathFind would be worth piloting at Strathmore?'
    )
    .setChoiceValues([
      'Definitely not worth piloting',
      'Probably not worth piloting',
      'Not sure',
      'Probably worth piloting',
      'Definitely worth piloting',
    ])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle(
      '7. What is the main thing, if anything, that might stop you from using StrathFind?'
    )
    .setChoiceValues([
      'Privacy or contact details being exposed',
      'False claims, scams, or unsafe handovers',
      'Not enough current, accurate listings',
      'Signing in or reporting would take too much effort',
      'I prefer existing options such as security desks or group chats',
      'I do not expect to need it',
      'Nothing in particular',
    ])
    .showOtherOption(true)
    .setRequired(true);

  form
    .addParagraphTextItem()
    .setTitle(
      '8. If an app like StrathFind existed, what would you want it to include or do?'
    )
    .setHelpText(
      'Please do not include names, contact details, or other sensitive personal information.'
    )
    .setRequired(false);

  Logger.log('Edit the form: ' + form.getEditUrl());
  Logger.log('Share this form: ' + form.getPublishedUrl());
}

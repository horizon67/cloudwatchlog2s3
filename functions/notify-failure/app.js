const request = require('request');

/**
 *
 * アーカイブに失敗した場合にSlackで通知する。
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 */
exports.lambdaHandler = async (event, context) => {
  const errorCause = JSON.parse(event.error.Cause);

  try {
    const params = {
      url: process.env.NOTIFY_SLACK_WEBHOOK_URL,
      form: 'payload={"text": "CloudWatchLogs Archive Failed. \n' + errorCause.errorMessage + '"}',
      json: true
    };

    const response = await request.post(params);
    console.log("notifyFailure success", response);
  } catch (err) {
    console.error("notifyFailure failed", err);
  }

  return;
};

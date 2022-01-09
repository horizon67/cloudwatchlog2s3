const aws = require('aws-sdk');
aws.config.update({region: 'ap-northeast-1'});
const cloudwatchlogs = new aws.CloudWatchLogs();

/**
 *
 * エクスポートタスクを確認しステータスを返却する。
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 * @returns {Object} object - ステータスコード
 *                              Valid Values: CANCELLED | COMPLETED | FAILED | PENDING | PENDING_CANCEL | RUNNING
 *                              @see: https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_DescribeExportTasks.html
 *
 */
exports.lambdaHandler = async (event, context) => {
  const taskId = event.iterator.taskId

  try {
    const params = { taskId: taskId }
    const response = await cloudwatchlogs.describeExportTasks(params).promise();
    console.log("describeExportTasks success", params.taskId, response);

    const responseTask = response.exportTasks[0];
    const statusCode = responseTask.status.code;
    console.log("Task ID:" + taskId);
    console.log("Status code:" + statusCode);
    return { 'statusCode': statusCode }
  } catch (err) {
    console.error("describeExportTasks failed.", err);
    throw new Error("describeExportTasks failed. taskId: " + taskId + "\n" + err);
  }
};

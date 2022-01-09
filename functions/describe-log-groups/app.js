const aws = require('aws-sdk');
aws.config.update({region: 'ap-northeast-1'});
const cloudwatchlogs = new aws.CloudWatchLogs();
// この保持期間を設定しているロググループを抽出
const retentionInDays = Number(process.env.RETENTION_IN_DAYS) === 0 ? undefined : Number(process.env.RETENTION_IN_DAYS);
const logGroupNamePrefix = process.env.LOG_GROUP_NAME_PREFIX

/**
 *
 * エクスポート対象のロググループを取得する。
 * 取得したロググループ名のリストとリストの数をステートマシンに返却する。
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 * @returns {Object} object - ロググループ数
 *                            ロググループ名
 *
 */
exports.lambdaHandler = async (event, context) => {
  try {
    let groups = [];
    let nextToken = null;
    let params = {}

    if (logGroupNamePrefix) {
      params.logGroupNamePrefix = logGroupNamePrefix
    }
    do {
      if (nextToken !== null) {
        params.nextToken = nextToken;
      }
      let data = await cloudwatchlogs.describeLogGroups(params).promise();
      for (var i = 0; i < data.logGroups.length; i++) {
        groups.push(data.logGroups[i]);
      }
      nextToken = data.nextToken;
    } while (nextToken !== null && nextToken !== undefined);

    console.log("describeLogGroups success");

    // 保持期間でフィルタリング
    const logGroups = groups.map(function(hash) {
      if (hash.retentionInDays === retentionInDays) {
        return hash.logGroupName;
      }
    }).filter(notUndefined => notUndefined !== undefined);

    return {
      'logGroupsCount': logGroups.length,
      'logGroups': logGroups
    }
  } catch (err) {
    console.error("describeLogGroups failed.", err);
    throw new Error("describeLogGroups failed." + "\n" + err);
  }
};


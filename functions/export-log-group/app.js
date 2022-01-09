const aws = require('aws-sdk');
aws.config.update({region: 'ap-northeast-1'});
const s3 = new aws.S3();
const cloudwatchlogs = new aws.CloudWatchLogs();
const { DateTime } = require('luxon');
const archiveTargetDateInterval = Number(process.env.ARCHIVE_TARGET_DATE_INTERVAL);
const archiveTargetDaysAgo = Number(process.env.ARCHIVE_TARGET_DAYS_AGO);
const s3BucketName = process.env.ARCHIVE_S3_BUCKET_NAME;

/**
 *
 * エクスポート(アーカイブ)を実行する。
 * 1回の実行でエクスポートを行うのは、1つのロググループのみ。ロググループが複数ある場合は、後続のステートからこのステートに処理が戻る。
 *
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 * @returns {Object} object - ロググループインデックス
 *                            describe-log-groupsで取得したログのアーカイブが全て完了したかどうかのフラグ
 *                            タスクID
 *
 */
exports.lambdaHandler = async (event, context) => {
  const getToTS = function(daysAgo) {
    // @see: https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_CreateExportTask.html
    return DateTime.local().setZone("Asia/Tokyo").minus({ days: daysAgo }).endOf('day').toMillis();
  };

  const getFromTS = function(toTS, interval) {
    // @see: https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_CreateExportTask.html
    return DateTime.fromMillis(toTS).setZone("Asia/Tokyo").minus({ days: interval }).startOf('day').toMillis();
  };

  const dateFormat = function(ts) {
    return DateTime.fromMillis(ts).setZone("Asia/Tokyo").toFormat('yyyy-MM-dd')
  };

  let index = event.iterator.index
  const toTS = getToTS(archiveTargetDaysAgo);
  const fromTS = getFromTS(toTS, archiveTargetDateInterval);
  const logGroupsCount = event.describeLogGroups.logGroupsCount
  const logGroupName = event.describeLogGroups.logGroups[index]
  const folder = archiveTargetDateInterval === 0 ? dateFormat(fromTS) : dateFormat(fromTS) + "_" + dateFormat(toTS)
  const destinationPrefix =  `${logGroupName.replace(/^\//,'').replace(/\//g,'-')}/` + folder

  console.log("logGroupName: ", logGroupName);
  console.log("FromDateTime: ", DateTime.fromMillis(fromTS).setZone("Asia/Tokyo").toISO());
  console.log("ToDateTime: ", DateTime.fromMillis(toTS).setZone("Asia/Tokyo").toISO());

  try {
    // エラー発生等でStep Functionsを再実行した場合、重複してアーカイブされる可能性があるのでs3の日付フォルダ内をクリア
    // 対象ファイルが多すぎてlambdaがtimeoutしてしまうようならtimeout時間を調整
    let listObjectsParams = { Bucket: s3BucketName, Prefix: destinationPrefix };
    let bucketObjects = [];
    let NextContinuationToken = null;

    do {
      if (NextContinuationToken) {
        listObjectsParams.ContinuationToken = NextContinuationToken;
      }
      const listedObjects = await s3.listObjectsV2(listObjectsParams).promise();
      if (listedObjects.KeyCount) {
        bucketObjects = bucketObjects.concat(listedObjects.Contents);
      }
     NextContinuationToken = listedObjects.NextContinuationToken;
    } while (NextContinuationToken !== null && NextContinuationToken !== undefined);

    if (bucketObjects.length !== 0) {
      const deleteParams = { Bucket: s3BucketName, Delete: { Objects: [] } };
      bucketObjects.forEach(({ Key }) => {
          deleteParams.Delete.Objects.push({ Key });
      });
      await s3.deleteObjects(deleteParams).promise();
      console.log("s3 deleteObjects success");
    }

    const params = {
      'taskName': `export_task_${logGroupName}` + (dateFormat(fromTS)),
      'logGroupName': logGroupName,
      'from': fromTS,
      'to': toTS,
      'destination': s3BucketName,
      'destinationPrefix': destinationPrefix
    };

    const response = await cloudwatchlogs.createExportTask(params).promise();
    console.log("createExportTask success", params.logGroupName, response);

    index += 1;

    return {
      'index': index,
      'isCompleted': logGroupsCount == index,
      'taskId': response.taskId
    }
  } catch (err) {
    console.error("createExportTask failed.", logGroupName, err);
    throw new Error("createExportTask failed. logGroupName: " + logGroupName + "\n" + err);
  }
};


/**
 * @version v1.0.1
 */

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {


  function afterSubmit(context) {
    try {
      if (context.type !== context.UserEventType.CREATE) return;


      var soId = context.newRecord.id;
      var petIdMap = {};
      var totalOriginalDiscount = 0;


      log.debug('Start', 'Processing Sales Order ID: ' + soId);


      // === 1. Fetch all line-level data ===
      var results = search.create({
        type: "salesorder",
        settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
        filters: [
          ["type", "anyof", "SalesOrd"],
          "AND", ["internalidnumber", "equalto", soId],
          "AND", ["mainline", "is", "F"],
          "AND", ["custbody_celigo_etail_order_id", "isnotempty", ""]
        ],
        columns: [
          "item",
          "discountamount",
          "custcol_ollie_pet_id",
          "quantity",
          "rate",
          "custcol_celigo_etail_order_line_id"
        ]
      }).run().getRange({ start: 0, end: 1000 });


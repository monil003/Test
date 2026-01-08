/**
 * @version v1.0.1
 */

/*
***********************************************************************
*
* The following Script is developed Dhruv Soni.
*
* Company:		 Trusscore Inc.
*
* Author:
* Date:        Sep 15, 2022
* File:
*
***********************************************************************/
/**
* The following entry point is deployed on Sales Order
* @return {Object} User Event Object.
*
* @NApiVersion 2.x
* @NScriptType UserEventScript
*
**/
define(['N/record','N/log','N/search', 'N/error','N/runtime','N/format'],
function(record, log, search, error,runtime,format) {
  function afterSubmit(context) {
    
    //test123 test1
    log.debug({title:'context',details:context})
    var executioncontext;
    executioncontext = runtime.executionContext;
    log.debug ({ title: 'executionContext', details:executioncontext });
    try {
      if (context.type != context.UserEventType.DELETE || context.type != context.UserEventType.VIEW){
        
        var ORDER_TYPES = {
          Sales_Order: 1,
          Consignment:2,
          RD_Trial:5,
          Intercompany_Transfer:6,
          Subcontracted:7,
          For_Inventory:8,
          RMA	:9,
          Non_Inventory_Return:10
        }
        
        var ORDER_REASON = {
          Sales_Order:1,
          Forecast:2,
          Advance_Replacement:3,
          Samples:4,
          Donation:5,
          VMI_Sale:6,
          Team_Member_Order:7,
          Transfer_Order:8,
          Product_Issue:9,
          Backorder_Cancellation:10,
          Pricing_issue_Credit_Rebill:11,
          Product_Sunset:12,
          Shipping_Issue:13,
          Warranty_Return:14,
          Approved_Customer_Return:15,
          Order_Entry_Issue:16,
          Customer_Issue:17,
          Product_Sunset:18,
          Shipping_Issue:19
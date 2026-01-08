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
    
    //test123
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
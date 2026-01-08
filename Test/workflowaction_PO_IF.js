/**
 * @version v1.0.1
 */

/**
* @NApiVersion 2.x
* @NScriptType WorkflowActionScript
* @NModuleScope SameAccount
*/
define(['N/render', 'N/file', 'N/record', 'N/email','N/search','N/runtime'], function(render, file, record, email,search,runtime){
  function onAction(scriptContext){


    var purchaseOrder = scriptContext.newRecord.id;
    log.debug({title:'purchaseOrder',details:purchaseOrder})
    var type = scriptContext.newRecord.type;
    log.debug({title:'type',details:type})


    try{




    }
    catch(error){
      if (error instanceof nlobjError) {
        var errorMsg = "Code: " + error.getCode() + " Details: " + error.getDetails();
        log.error('An error occurred.', errorMsg);
      }
      else {
        log.error('An unknown error occurred.', error.toString());
      }
    }
  }






  function isEmpty(value) {
    if (value === null) {
      return true;
    } else if (value === undefined) {
      return true;
    } else if (value === '') {
      return true;
    } else if (value === ' ') {
      return true;
    } else if (value === 'null') {
      return true;
    } else {
      return false;
    }
  }


  return{
    onAction: onAction
  }
});


/**
*@NApiVersion 2.x
*@NScriptType ScheduledScript
*/
​
/*
**********************************************************************
***********************************************************************
* Script Description:
* This is a scheduled script that runs once every night to chnage Assembly Buid Update checkbox to TRUE
* Record Type = customrecord1503//Build Qty Update
***********************************************************************
*/
​
define(['N/log','N/search','N/record'],
function(log,search,record){
  function updateBuildCheckbox(scriptContext){

    //test2

    var customrecord1503SearchObj = search.create({
      type: "customrecord1503",
      filters:
      [
        ["custrecord_tc_assembly_build","is","F"]
      ],
      columns:
      [
        search.createColumn({name: "internalid", label: "Internal ID"})
      ]
    });
    var searchResultCount = customrecord1503SearchObj.runPaged().count;
    log.debug("customrecord1503SearchObj result count",searchResultCount);
    customrecord1503SearchObj.run().each(function(result){

      var id = result.getValue({name:'internalid'})

      var loadedRecord = record.load({type:'customrecord1503',id:id,isDynamic:true})
      //loadedRecord.setValue({fieldId:'custrecord_tc_assembly_build',value:true})
      loadedRecord.save()
      //record.submitFields({type:'customrecord1503',id:id,id,values:{custrecord_tc_assembly_build:true}})

      return true;
    });  ​
  }
  return{
    execute: updateBuildCheckbox
  };
})

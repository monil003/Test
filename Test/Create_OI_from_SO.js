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
    
    //test123 test1 test3
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
        }
        
        var current_record = context.newRecord;
        var recID = current_record.id;
        var recType = current_record.type;
        log.debug('recID',recID)
        var orderStatus = current_record.getValue({fieldId:'orderstatus'});
        log.debug({title:'orderStatus',details:orderStatus})
        var estShipDate = current_record.getValue({fieldId:'custbody_tc_ship_date_estimated'});
        log.debug({title:'estShipDate',details:estShipDate})
        
        //********************************************//
        // if(context.type == context.UserEventType.CREATE && estShipDate){
        //   var suppReqDate = getCorrectSupplyReqDate(estShipDate)
        //   log.debug({title:'suppReqDate',details:suppReqDate})
        //   suppReqDate = new Date(suppReqDate)

        //   var sales_order = record.load({
        //     type: recType,
        //     id: recID,//sales_order_id,
        //     isDynamic:true
        //   });

        //   var getLineCount = sales_order.getLineCount({
        //     sublistId:'item'
        //   })

        //   for (var i = 0; i < getLineCount; i++) {

        //     sales_order.selectLine({
        //       sublistId:'item',
        //       line:i
        //     })

        //     sales_order.setCurrentSublistValue({
        //       sublistId:'item',
        //       fieldId:'requesteddate',
        //       value:suppReqDate
        //     })
        //     sales_order.commitLine({
        //       sublistId:'item'
        //     })
          
        //   }
        //   sales_order.save()
        // }
                if(context.type == context.UserEventType.EDIT && estShipDate){
          var suppReqDate = getCorrectSupplyReqDate(estShipDate,7)
          log.debug({title:'suppReqDate',details:suppReqDate})
          suppReqDate = new Date(suppReqDate)

          var sales_order = record.load({
            type: recType,
            id: recID,//sales_order_id,
            isDynamic:true
          });

          var getLineCount = sales_order.getLineCount({
            sublistId:'item'
          })

          for (var i = 0; i < getLineCount; i++) {

            sales_order.selectLine({
              sublistId:'item',
              line:i
            })

            sales_order.setCurrentSublistValue({
              sublistId:'item',
              fieldId:'requesteddate',
              value:suppReqDate
            })
            
           
           var shipment_Date =  sales_order.getCurrentSublistValue({
              sublistId:'item',
              fieldId:'custcol_tc_scheduled_ship_date'
            })
            if(shipment_Date){
            log.debug({title:'shipDate',details:shipment_Date})
            
            shipment_Date = format.format({value:shipment_Date,type:format.Type.DATE});
            log.debug({title:'shipment_Date',details:shipment_Date})
            
            
            var correctSupDate = getCorrectSupplyReqDate(shipment_Date,3)
            log.debug({title:'correctSupDate',details:correctSupDate})
            sales_order.setCurrentSublistValue({
              sublistId:'item',
              fieldId:'requesteddate',
              value:new Date(correctSupDate)
            })
               
          }
           sales_order.commitLine({
              sublistId:'item'
            })          
          }
          sales_order.save()
        }

      
        if(orderStatus == "A" && executioncontext != 'USEREVENT1' && executioncontext != 'USERINTERFACE1') {
          
          var sales_order = record.load({
            type: recType,
            id: recID,//sales_order_id,
            isDynamic:true
          });
          
          var customer = sales_order.getValue('entity');
          var customerText = sales_order.getText({fieldId:'entity'})
          var date = sales_order.getValue('trandate');
          var subsidiary = sales_order.getValue('subsidiary');
          var order_number = sales_order.getValue({fieldId:'tranid'});
          var soTotal = sales_order.getValue({fieldId:'total'});
          var sf_opp_id = sales_order.getValue({fieldId:'custbody_celigo_sfio_sf_id'});
          log.debug({title:'sf_opp_id',details:sf_opp_id})
          
          var sf_opp_name = sales_order.getValue({fieldId:'custbody_tc_sf_opp_name'})
          log.debug({title:'sf_opp_name',details:sf_opp_name})
          
          var salesrep = sales_order.getValue({fieldId:'salesrep'})
          if(isEmpty(sf_opp_id)){
            sf_opp_id = order_number;
          }else{
            var customrecord_tc_oiSearchObj = search.create({
              type: "customrecord_tc_oi",
              filters:
              [
                ["name","is",sf_opp_id]
              ],
              columns:
              [
                
                search.createColumn({name: "internalid", label: "internal ID"})
              ]
            });
            var searchResultCount = customrecord_tc_oiSearchObj.runPaged().count;
            log.debug("customrecord_tc_oiSearchObj result count",searchResultCount);
            customrecord_tc_oiSearchObj.run().each(function(result){
              var internlid = result.getValue({name:'internalid'})
              log.debug({title:'internlid',details:internlid})
              
              record.delete({type:'customrecord_tc_oi',id:internlid});
              
              return true;
            });
            
          }
          
          var lineCount = sales_order.getLineCount({sublistId:'item'});
          var sales_order_type = sales_order.getValue({fieldId:'custbody_tc_order_type'});
          var order_reason = sales_order.getValue({fieldId:'custbody_tc_rma_reason'});
          log.debug({title:'order_reason',details:order_reason})
          
          var old_so_sf_id = sales_order.getValue({fieldId:'custbody_tc_old_sf_so_id'})
          log.debug({title:'old_so_sf_id',details:isEmpty(old_so_sf_id)})
          
          if(isEmpty(old_so_sf_id)){
            
            old_so_sf_id = recID;
            log.debug({title:'old_so_sf_id',details:old_so_sf_id})
            
          }
          else{
            old_so_sf_id = lookupSalesID(old_so_sf_id);
          }
          
          if(lineCount >0){
            
            for (var i = 0; i < lineCount; i++) {
              
              sales_order.selectLine({sublistId:'item',line:i})
              
              var item = sales_order.getCurrentSublistValue({sublistId:'item',fieldId:'item'})
              var qty = sales_order.getCurrentSublistValue({sublistId:'item',fieldId:'quantity'})
              var rate = sales_order.getCurrentSublistValue({sublistId:'item',fieldId:'rate'})
              var amount = sales_order.getCurrentSublistValue({sublistId:'item',fieldId:'amount'})
              var sf_line_id = sales_order.getCurrentSublistValue({sublistId:'item',fieldId:'custcol_celigo_sfio_sf_id'});
              var discount = sales_order.getCurrentSublistValue({sublistId:'item',fieldId:'custcol_tc_discount'});
              
              
              if(order_reason == ORDER_REASON.Backorder_Cancellation || order_reason == ORDER_REASON.Product_Sunset || order_reason == ORDER_REASON.Pricing_issue_Credit_Rebill || order_reason == ORDER_REASON.Shipping_Issue ){ // 5 == Order Cancellation
                qty = qty*-1;
                amount = amount*-1;
              }
              //***************************************************** Creating OI record **************************************************************************//
              if(order_reason == ORDER_REASON.Sales_Order || order_reason == ORDER_REASON.Backorder_Cancellation || order_reason == ORDER_REASON.Product_Sunset || order_reason == ORDER_REASON.Donation || order_reason == ORDER_REASON.VMI_Sale || order_reason == ORDER_REASON.Team_Member_Order || order_reason == ORDER_REASON.Pricing_issue_Credit_Rebill || order_reason == ORDER_REASON.Shipping_Issue ){
                //***********************************************//
                var create_OI_record = record.create({
                  type: 'customrecord_tc_oi'
                });
                
                create_OI_record.setValue({fieldId:'name',value:sf_opp_id});
                create_OI_record.setValue({fieldId:'custrecord_tc_oi_type',value:sales_order_type});
                create_OI_record.setValue({fieldId:'custrecord_td_oi_number',value:order_number})
                create_OI_record.setValue({fieldId:'custrecord_tc_oi_customer',value:customer});
                create_OI_record.setValue({fieldId:'custrecord_tc_oi_item',value:item});
                create_OI_record.setValue({fieldId:'custrecord_tc_oi_qty',value:qty});
                create_OI_record.setValue({fieldId:'custrecord_tc_cancel_reason',value:order_reason});
                create_OI_record.setValue({fieldId:'custrecord_tc_oi_sfopp',value:sf_line_id});
                create_OI_record.setValue({fieldId:'custrecord_tc_amount',value:amount});
                create_OI_record.setValue({fieldId:'custrecord_tc_date',value:date});
                create_OI_record.setValue({fieldId:'custrecord_tc_sales_rep',value:salesrep})
                create_OI_record.setValue({fieldId:'custrecord_tc_old_sf_so_id',value:old_so_sf_id});
                create_OI_record.setValue({fieldId:'custrecord_tc_opportunity_name',value:sf_opp_name});
                create_OI_record.setValue({fieldId:'custrecord_tc_rate',value:rate});
                create_OI_record.setValue({fieldId:'custrecord_tc_discount',value:discount});
                
                
                
                create_OI_record.save();
                
                //********************************************************//
              }
              
              
              //************************************************ Closing The Demand by editing the old sales order *******************************************************//
              if(order_reason == ORDER_REASON.Backorder_Cancellation || order_reason == ORDER_REASON.Product_Sunset ){
                
                var old_so_record = record.load({
                  type: record.Type.SALES_ORDER,
                  id: old_so_sf_id,//order_intake_id,
                  isDynamic:true
                });
                var line_id = getLineID(old_so_sf_id,item)
                
                line_id = old_so_record.findSublistLineWithValue({sublistId:'item',fieldId:'line',value:line_id});
                var line_sf_id = old_so_record.findSublistLineWithValue({sublistId:'item',fieldId:'custcol_celigo_sfio_sf_id',value:sf_line_id});
                log.debug({title:'line_id',details:line_id})
                
                if(line_id != -1 && line_sf_id == -1){
                  
                  old_so_record.selectLine({sublistId:'item',line:line_id});
                  
                  var line_qty = old_so_record.getCurrentSublistValue({sublistId:'item',fieldId:'quantity'});
                  log.debug({title:'line_qty',details:line_qty});
                  
                  var rate = old_so_record.getCurrentSublistValue({sublistId:'item',fieldId:'rate'});
                  log.debug({title:'rate',details:rate})
                  var dicsount = old_so_record.getCurrentSublistValue({sublistId:'item',fieldId:'custcol_tc_discount'});
                  log.debug({title:'dicsount',details:dicsount})
                  
                  if(isEmpty(dicsount)){
                    dicsount = 0;
                  }else{
                    dicsount = parseFloat(dicsount)
                  }
                  
                  line_qty = line_qty - Math.abs(qty);
                  log.debug({title:'update_line_qty',details:line_qty})
                  log.debug({title:'dicsount',details:dicsount})
                  
                  
                  var discounted_amount_old_line = (line_qty*rate) - (line_qty*rate*dicsount)/100;
                  log.debug({title:'discounted_amount_old_line',details:discounted_amount_old_line})
                  if(dicsount != 0 || !isEmpty(dicsount)){
                    log.debug({title:'coming in IF',details:'Coming in IF'})
                    
                    var discounted_amount_new_line = (Math.abs(qty)*rate) - (Math.abs(qty)*rate*dicsount)/100;
                    log.debug({title:'discounted_amount_new_line',details:discounted_amount_new_line})
                    var discounted_amount_old_line = (line_qty*rate) - (line_qty*rate*dicsount)/100;
                    log.debug({title:'discounted_amount_old_line',details:discounted_amount_old_line})
                  }else{
                    var discounted_amount_new_line = (Math.abs(qty)*rate);
                    log.debug({title:'discounted_amount_new_line',details:discounted_amount_new_line})
                    var discounted_amount_old_line = (line_qty*rate);
                    log.debug({title:'discounted_amount_old_line',details:discounted_amount_old_line})
                  }
                  
                  if(line_qty == 0){
                  old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'quantity',value:Math.abs(qty)});
                  old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'amount',value:discounted_amount_old_line});
                  old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'isclosed',value:true});

                  
                  old_so_record.commitLine({sublistId:'item'});
                  }else{
                     old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'quantity',value:line_qty});
                  old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'amount',value:discounted_amount_old_line});
                  
                  
                  old_so_record.commitLine({sublistId:'item'});
                  }
                  
                 
                  
                  if(line_qty != 0){
                    old_so_record.selectNewLine({sublistId:'item'});
                  old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'item',value:item});
                  old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'quantity',value:Math.abs(qty)});
                  old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'custcol_tc_discount',value:dicsount});
                  old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'custcol_celigo_sfio_sf_id',value:sf_line_id});
                  old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'isclosed',value:true});
                  old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'rate',value:rate});
                  old_so_record.setCurrentSublistValue({sublistId:'item',fieldId:'amount',value:discounted_amount_new_line});
                  
                  old_so_record.commitLine({sublistId:'item'});
                  }
                  
                }
                old_so_record.save();
              }
              
              
              //************************************************* Creating Order reservation for forcast orders ***************************************************************//
              if(order_reason == ORDER_REASON.Forecast){
                
                log.debug({title:'old_so_sf_id',details:'test'})
                
                var order_reservation = record.create({type:'orderreservation'})
                
                order_reservation.setValue({fieldId:'name',value:customerText + i + recID});
                order_reservation.setValue({fieldId:'subsidiary',value:subsidiary});
                order_reservation.setValue({fieldId:'item',value:item});
                order_reservation.setValue({fieldId:'location',value:220});
                order_reservation.setValue({fieldId:'saleschannel',value:1});
                order_reservation.setValue({fieldId:'orderallocationstrategy',value:2});
                order_reservation.setValue({fieldId:'startdate',value:date});
                var endDate = new Date(date);
                endDate.setMonth(endDate.getMonth() + 1);
                order_reservation.setValue({fieldId:'enddate',value:endDate});
                order_reservation.setValue({fieldId:'transactiondate',value:date});
                order_reservation.setValue({fieldId:'quantity',value:qty});
                order_reservation.setValue({fieldId:'commitmentfirm',value:false});
                
                order_reservation.save();
                
                
              }
              
            }
            if(order_reason == ORDER_REASON.Backorder_Cancellation || order_reason == ORDER_REASON.Product_Sunset || order_reason == ORDER_REASON.Forecast ){ // 5 == Order Cancellation
              var salesOrderRecord = record.delete({
                type: record.Type.SALES_ORDER,
                id: recID,
              });
            }else{
              sales_order.save();
            }
          }
        }
      }
    } catch (e) {
      log.error({title:'error',details:e})
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
  
  function getCorrectSupplyReqDate(dateStr,daysNeedsToBeBackTrack){
    // Convert the string to a Date object
    var date = new Date(dateStr);
    
    // Subtract 7 days from the date
    date.setDate(date.getDate() - daysNeedsToBeBackTrack);
    
    // Format the date back to MM/DD/YYYY format
    var month = date.getMonth() + 1; // Months are zero-based in JavaScript
    var day = date.getDate();
    var year = date.getFullYear();
    
    // Format the result as 'MM/DD/YYYY'
    var formattedDate = month + '/' + day + '/' + year;

    return formattedDate;
  }
  
  function getLineID(old_so_sf_id,item){
    var lineID;
    var salesorderSearchObj = search.create({
      type: "salesorder",
      filters:
      [
        ["type","anyof","SalesOrd"], 
        "AND", 
        ["internalid","anyof",old_so_sf_id], 
        "AND", 
        ["item","anyof",item], 
        "AND", 
        ["formulanumeric: case when {quantity} != {quantitypacked} then 1 else 0 end","equalto","1"],
        "AND", 
        ["closed","is","F"],
        "AND", 
        ["custcol_tc_related_shipping_record","anyof","@NONE@"]
      ],
      columns:
      [
        search.createColumn({name: "tranid", label: "Document Number"}),
        search.createColumn({name: "line", label: "Line ID"}),
        search.createColumn({name: "item", label: "Item"}),
        search.createColumn({name: "quantityshiprecv", label: "Quantity Fulfilled/Received"}),
        search.createColumn({name: "quantitypacked", label: "Quantity Packed"}),
        search.createColumn({name: "quantitypicked", label: "Quantity Picked"})
      ]
    });
    var searchResultCount = salesorderSearchObj.runPaged().count;
    log.debug("salesorderSearchObj result count",searchResultCount);
    salesorderSearchObj.run().each(function(result){
      lineID = result.getValue({name:'line'})
      return true;
    });
    
    return lineID;
  }
  
  function lookupSalesID(old_so_sf_id){
    var internalID;
    var salesorderSearchObj = search.create({
      type: "salesorder",
      filters:
      [
        ["type","anyof","SalesOrd"],
        "AND",
        ["mainline","is","T"],
        "AND",
        ["custbody_celigo_sfio_sf_id","is",old_so_sf_id]
      ],
      columns:
      [
        search.createColumn({
          name: "internalid"
        }),
        
      ]
    });
    var searchResultCount = salesorderSearchObj.runPaged().count;
    log.debug("salesorderSearchObj result count",searchResultCount);
    salesorderSearchObj.run().each(function(result){
      internalID = result.getValue({name:'internalid'})
      return true;
    });
    
    return internalID;
  }
  return{
    afterSubmit:afterSubmit
  };
});

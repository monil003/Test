/**
 * @version v1.0.1
 */

/**
*
* Script Type: MapReduceScript
* @NApiVersion 2.1
* @NScriptType MapReduceScript
**/

define(['N/error', 'N/record', 'N/runtime', 'N/render', 'N/email', 'N/search', 'N/task', 'N/format'], mapReduce);
function mapReduce(error, record, runtime, render, email, search, task, format) {

    const SAMPLE_USER_EMPLOYEE_ID = 125156;

    function getInputData(inputContext) {
        try {

            var curScriptObj = runtime.getCurrentScript();
            var userObj = runtime.getCurrentUser().id;
            log.debug({ title: 'userObj', details: userObj })
            var selectedPurchaseOrder = JSON.parse(curScriptObj.getParameter({ name: 'custscript_script_object_tc' }));
            log.debug({ title: 'selectedPurchaseOrder', details: selectedPurchaseOrder });

            if (selectedPurchaseOrder[0].isIFOrder) {
                return selectedPurchaseOrder;
            }

            var shipment_Date = selectedPurchaseOrder[0]['shipment_date'];
            var location_new = selectedPurchaseOrder[0]['location_new'];
            var location_name = selectedPurchaseOrder[0]['location_name'];
            var customerID = selectedPurchaseOrder[0]['customerID'];
            var subid = selectedPurchaseOrder[0]['subid'];
            var create_shipping_rec = selectedPurchaseOrder[0]['create_shipping_rec'];
            var tracking_number = selectedPurchaseOrder[0]['tracking_number'];
            var shipping_cost = selectedPurchaseOrder[0]['shipping_cost'];
            var shipping_method = selectedPurchaseOrder[0]['shipping_method'];

            var gropedByCustomer = groupByItem(selectedPurchaseOrder, 'internalID');
            log.debug({ title: 'gropedByCustomer', details: gropedByCustomer });

            return gropedByCustomer;

        } catch (error) {
            log.error({ title: 'mapReduce.getInputData', details: error });
            throw error;
        }
    }

    function map(context) {
        try {
            var purchaseOrderID = JSON.parse(context.value);
            log.debug({ title: 'purchaseOrderID', details: purchaseOrderID });

            if (!purchaseOrderID.isIFOrder) {

                var salesorderID = purchaseOrderID[0]['internalID']
                log.debug({ title: 'salesorderID', details: salesorderID })
                var load_sales_order = record.load({ type: record.Type.SALES_ORDER, id: salesorderID, isDynamic: true });

                var createIF = purchaseOrderID[0]['create_shipping_rec'] == 'T';

                for (var i = 0; i < purchaseOrderID.length; i++) {

                    var itemID = purchaseOrderID[i].itemID;
                    var qty = purchaseOrderID[i].shippingQty || purchaseOrderID[i].qty;
                    var shipment_Date = purchaseOrderID[i].shipment_date;
                    var new_location = purchaseOrderID[i].location_new
                    var linenumber = purchaseOrderID[i].line_id;

                    var lineID = load_sales_order.findSublistLineWithValue({ sublistId: 'item', fieldId: 'line', value: linenumber });
                    log.debug({ title: 'lineID', details: lineID })

                    var lineQty = load_sales_order.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineID });
                    log.debug({ title: 'lineQty', details: lineQty })

                    if (lineID != -1) {
                        load_sales_order.selectLine({ sublistId: 'item', line: lineID });

                        if (shipment_Date) {
                            log.debug({ title: 'shipDate', details: shipment_Date })
                            load_sales_order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_tc_scheduled_ship_date', value: new Date(shipment_Date) });
                        }

                        if (new_location) {
                            load_sales_order.setCurrentSublistValue({ sublistId: 'item', fieldId: 'inventorylocation', value: new_location });
                        }
                        load_sales_order.commitLine({ sublistId: 'item' })
                    }

                }
                load_sales_order.save({ enableSourcing: true, ignoreMandatoryFields: true })
                log.debug({ title: 'shipment_Date', details: "shipment_Date" });

                if (createIF) {
                    if (purchaseOrderID[0].location_new) {
                        var ifRec = record.transform({
                            fromType: 'salesorder',
                            fromId: parseInt(salesorderID),
                            toType: 'itemfulfillment',
                            isDynamic: true,
                            defaultValues: { inventorylocation: new_location }
                        });
                    } else {
                        var ifRec = record.transform({
                            fromType: 'salesorder',
                            fromId: parseInt(salesorderID),
                            toType: 'itemfulfillment',
                            isDynamic: true
                        });
                    }

                    log.debug({ title: 'ifRec', details: ifRec })
                    var lineCount = ifRec.getLineCount({ sublistId: 'item' })
                    for (var index = 0; index < lineCount; index++) {
                        ifRec.selectLine({ sublistId: 'item', line: index })
                        var lineIdOrder = ifRec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'orderline' })
                        log.debug({ title: 'lineIdOrder', details: lineIdOrder })
                        ifRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: false })
                        ifRec.commitLine({ sublistId: 'item' })
                    }
                    for (var x = 0; x < purchaseOrderID.length; x++) {

                        var itemID = purchaseOrderID[x].itemID;
                        //var qty = purchaseOrderID[x].qty;
                        var qty = purchaseOrderID[x].shippingQty || purchaseOrderID[x].qty;
                        var shipment_Date = purchaseOrderID[x].shipment_date;
                        var new_location = purchaseOrderID[x].location_new
                        var linenumber = purchaseOrderID[x].line_id;
                        log.debug('purchaseOrderID', purchaseOrderID[x])


                        var lineid = ifRec.findSublistLineWithValue({ sublistId: 'item', fieldId: 'orderline', value: linenumber });
                        log.debug('lineid', lineid)
                        if (lineid == -1) continue;

                        ifRec.selectLine({ sublistId: 'item', line: lineid })
                        ifRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true })
                        if (new_location) ifRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: new_location })
                        ifRec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: qty })

                        // ===== INVENTORY DETAIL SUBRECORD =====
                        //   var invDetail = ifRec.getCurrentSublistSubrecord({
                        //     sublistId: 'item',
                        //     fieldId: 'inventorydetail'
                        //   });
                        // log.debug('invDetail',invDetail)
                        //   if (invDetail) {
                        //     // Clear existing inventory assignment lines (if any)
                        //     var invLineCount = invDetail.getLineCount({
                        //       sublistId: 'inventoryassignment'
                        //     });
                        //     log.debug('invLineCount',invLineCount)

                        //     log.debug('qty',qty)

                        //     invDetail.setCurrentSublistValue({
                        //       sublistId: 'inventoryassignment',
                        //       fieldId: 'inventorystatus',
                        //       value: 1
                        //     });

                        //     invDetail.setCurrentSublistValue({
                        //       sublistId: 'inventoryassignment',
                        //       fieldId: 'quantity',
                        //       value: qty
                        //     });

                        //     invDetail.commitLine({
                        //       sublistId: 'inventoryassignment'
                        //     });
                        // }

                        ifRec.commitLine({ sublistId: 'item' })

                    }

                    ifRec.setValue({
                        fieldId: 'shipstatus',
                        value: "A"
                    });

                    if (purchaseOrderID[0].tracking_number) {
                        ifRec.selectLine({ sublistId: 'package', line: 0 });

                        ifRec.setCurrentSublistValue({
                            sublistId: 'package',
                            fieldId: 'packagetrackingnumber',
                            value: purchaseOrderID[0].tracking_number
                        });

                        ifRec.commitLine({ sublistId: 'package' });
                    }

                    try {
                        if (purchaseOrderID[0].shipping_cost && purchaseOrderID[0].shipping_method) {
                            ifRec.setValue({
                                fieldId: 'shipmethod',
                                value: purchaseOrderID[0].shipping_method
                            });

                            ifRec.setValue({
                                fieldId: 'shippingcost',
                                value: parseFloat(purchaseOrderID[0].shipping_cost) || 0
                            });
                        }
                    } catch (error) {
                        log.debug('Error', error);
                    }

                    itemFulfillmentRec = ifRec.save({ enableSourcing: true, ignoreMandatoryFields: true });

                    if (itemFulfillmentRec) {
                        var salesRep = load_sales_order.getValue("salesrep");
                        var endCustomerEmail = load_sales_order.getValue("custbody_end_customer_contact_email");
                        var SO_num = load_sales_order.getValue("tranid");
                        var userObj = SAMPLE_USER_EMPLOYEE_ID;

                        // Load the saved Item Fulfillment to get `tranid`
                        var ifSavedRec = record.load({
                            type: record.Type.ITEM_FULFILLMENT,
                            id: ifRec.id
                        });

                        var ifTranId = ifSavedRec.getValue({ fieldId: 'tranid' });

                        var updated_so = record.load({
                            type: record.Type.SALES_ORDER,
                            id: salesorderID,
                            isDynamic: true
                        });

                        log.debug({ title: 'userObj', details: userObj });
                        log.debug({ title: 'salesRep', details: salesRep });

                        // if (salesRep && SO_num && userObj) {
                        //   // var subject = 'Item Fulfillment Created: ' + ifTranId;
                        //   const trackingNum = ifSavedRec.getSublistValue({
                        //     sublistId: 'package',
                        //     fieldId: 'packagetrackingnumber',
                        //     line: 0
                        //   });

                        //   var subject = trackingNum ? 'Your Trusscore Sample Order Has Been Shipped – Tracking Number #' + trackingNum : 'Your Trusscore sample order has been shipped';

                        //   var body = buildFulfillmentEmailBody(updated_so, ifSavedRec, purchaseOrderID[0]);

                        //   if (endCustomerEmail) {
                        //     email.send({
                        //       author: userObj,
                        //       recipients: endCustomerEmail,
                        //       cc: [salesRep],
                        //       subject: subject,
                        //       body: body,
                        //       relatedRecords: {
                        //         transactionId: itemFulfillmentRec // ID of the Item Fulfillment record
                        //       }
                        //     });
                        //   } else if (salesRep) {
                        //     email.send({
                        //       author: userObj,
                        //       recipients: salesRep,
                        //       subject: subject,
                        //       body: body,
                        //       relatedRecords: {
                        //         transactionId: itemFulfillmentRec // ID of the Item Fulfillment record
                        //       }
                        //     });
                        //   }
                        // }
                    }
                }
            } else {
                updateIF(purchaseOrderID)
            }

        } catch (error) {
            log.error({ title: 'mapReduce.map', details: error });
            throw error;
        }
    }

    function summarize(summary) {

        summary.mapSummary.errors.iterator().each(function (key, value) {
            log.error(key, 'ERROR String: ' + value);
            return true;
        });
    }

    function groupByItem(list, key) {
        return list.reduce(function (rv, x) {
            (rv[x[key]] = rv[x[key]] || []).push(x);
            return rv;
        }, {});
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

    function getCustomerEmail(customerId) {
        if (!customerId) return null;

        var email = search.lookupFields({
            type: search.Type.CUSTOMER,
            id: customerId,
            columns: ['email']
        }).email;

        return email || null;
    }

    function updateIF(obj) {
        try {
            log.debug('obj', obj);
            if (!obj.IFnum) return {};

            const IFRec = record.load({
                type: record.Type.ITEM_FULFILLMENT,
                id: obj.IFnum,
                isDynamic: true
            });

            if (!IFRec) return {};

            IFRec.setValue({
                fieldId: 'shipstatus',
                value: "C"
            });

            if (obj.trackingNum) {
                IFRec.selectLine({ sublistId: 'package', line: 0 });

                IFRec.setCurrentSublistValue({
                    sublistId: 'package',
                    fieldId: 'packageweight',
                    value: 1
                });

                IFRec.setCurrentSublistValue({
                    sublistId: 'package',
                    fieldId: 'packagetrackingnumber',
                    value: obj.trackingNum
                });

                IFRec.commitLine({ sublistId: 'package' });
            }

            if (obj.shippingMethod) {
                IFRec.setValue({
                    fieldId: 'shipmethod',
                    value: obj.shippingMethod
                });
            }

            if (obj.shippingCost) {
                IFRec.setValue({
                    fieldId: 'shippingcost',
                    value: obj.shippingCost
                });
            }

            const itemFulfillmentRec = IFRec.save({ enableSourcing: true, ignoreMandatoryFields: true });

            const userObj = SAMPLE_USER_EMPLOYEE_ID;
            const salesorderID = IFRec.getValue('createdfrom');

            if (!salesorderID) return;

            const load_sales_order = record.load({
                type: record.Type.SALES_ORDER,
                id: salesorderID,
                isDynamic: true
            });

            let scheduleShipDateIF;

            try {
                scheduleShipDateIF = IFRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_tc_scheduled_ship_date',
                    line: 0
                });
            } catch (error) {
                log.debug('error in schedule ship date fetching');
            }

            const salesRep = load_sales_order.getValue("salesrep");
            const endCustomerEmail = load_sales_order.getValue("custbody_end_customer_contact_email");
            const SO_num = load_sales_order.getValue("tranid");
            const ifTranId = IFRec.getValue({ fieldId: 'tranid' });

            if (salesRep && SO_num && userObj) {
                const trackingNum = obj.trackingNum;

                const subject = trackingNum ? 'Your Trusscore Sample Order Has Been Shipped – Tracking Number #' + trackingNum : 'Your Trusscore sample order has been shipped';

                const body = buildFulfillmentEmailBody(load_sales_order, IFRec, scheduleShipDateIF);

                if (endCustomerEmail) {
                    email.send({
                        author: userObj,
                        recipients: endCustomerEmail,
                        cc: [salesRep],
                        subject: subject,
                        body: body,
                        relatedRecords: {
                            transactionId: itemFulfillmentRec
                        }
                    });
                } else if (salesRep) {
                    email.send({
                        author: userObj,
                        recipients: salesRep,
                        subject: subject,
                        body: body,
                        relatedRecords: {
                            transactionId: itemFulfillmentRec
                        }
                    });
                }
            }
        } catch (error) {
            log.debug('error', error);
        }
    }

    function buildFulfillmentEmailBody(soRec, ifRec, scheduleShipDate) {
        var SO_num = soRec.getValue({ fieldId: 'tranid' });
        var ifTranId = ifRec.getValue({ fieldId: 'tranid' });
        var shippingMethod = ifRec.getText({ fieldId: 'shipmethod' }) || '-';
        var shipDate = scheduleShipDate || '-';
        var trackingNumber = ifRec.getSublistValue({
            sublistId: 'package',
            fieldId: 'packagetrackingnumber',
            line: 0
        }) || '-';

        // Header Info
        var htmlBody = '<div style="font-family: Arial, sans-serif; font-size: 13px; color: #333;">';
        htmlBody += '<h3 style="margin-bottom:5px;">Trusscore Sample Order Shipped</h3>';
        htmlBody += '<table cellpadding="4" cellspacing="0" border="0" style="font-size:13px;">';
        htmlBody += '<tr><td><strong>Sales Order:</strong></td><td>' + SO_num + '</td></tr>';
        htmlBody += '<tr><td><strong>Item Fulfillment:</strong></td><td>' + ifTranId + '</td></tr>';
        htmlBody += '<tr><td><strong>Shipping Method:</strong></td><td>' + shippingMethod + '</td></tr>';
        htmlBody += '<tr><td><strong>Ship Date:</strong></td><td>' + shipDate + '</td></tr>';
        htmlBody += '<tr><td><strong>Tracking Number:</strong></td><td>' + trackingNumber + '</td></tr>';
        htmlBody += '</table><br>';

        // Items Table
        htmlBody += '<h4 style="margin-bottom:5px;">Item Details</h4>';
        htmlBody += '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width:100%; font-size:13px; font-family:Arial;">';
        htmlBody += '<thead style="background-color:#f2f2f2; font-weight:bold; text-align:center;">' +
            '<tr>' +
            '<th style="width:30%; text-align:center;">Item</th>' +
            '<th style="width:20%; text-align:center;">Description</th>' +
            '<th style="width:15%; text-align:center;">Ordered Qty</th>' +
            '<th style="width:15%; text-align:center;">Fulfilled Qty</th>' +
            '<th style="width:15%; text-align:center;">Remaining Qty</th>' +
            '<th style="width:25%; text-align:center;">Status</th>' +
            '</tr></thead><tbody>';

        var soLineCount = soRec.getLineCount({ sublistId: 'item' });
        for (var j = 0; j < soLineCount; j++) {
            var soItemId = soRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
            var soItemName = soRec.getSublistText({ sublistId: 'item', fieldId: 'item', line: j });
            var qtyOrdered = soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: j });
            var qtyFulfilled = soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantityfulfilled', line: j }) || 0;
            var qtyRemaining = qtyOrdered - qtyFulfilled;
            var description = soRec.getSublistText({ sublistId: 'item', fieldId: 'description', line: j }) || '-';

            var logged = {
                soItemName: soItemName,
                qtyOrdered: qtyOrdered,
                qtyFulfilled: qtyFulfilled,
                qtyRemaining: qtyRemaining,
                qtyIs: soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantityfulfilled', line: j })
            }

            log.debug('logged', logged);

            var onHandQty = '-';
            try {
                var itemRec = record.load({ type: record.Type.INVENTORY_ITEM, id: soItemId });
                onHandQty = itemRec.getValue({ fieldId: 'quantityonhand' }) || 0;
            } catch (e) {
                onHandQty = 'N/A'; // Non-inventory item
            }

            var lineStatus;
            if (qtyFulfilled === 0) {
                lineStatus = 'Pending Fulfillment';
            } else if (qtyRemaining === 0) {
                lineStatus = 'Fulfilled';
            } else {
                lineStatus = 'Partially Fulfilled';
            }

            // Alternate row coloring
            var rowColor = (j % 2 === 0) ? '#ffffff' : '#f9f9f9';

            htmlBody += '<tr style="text-align:center; background-color:' + rowColor + ';">' +
                '<td style="text-align:left;">' + soItemName + '</td>' +
                '<td>' + description + '</td>' +
                '<td>' + qtyOrdered + '</td>' +
                '<td>' + qtyFulfilled + '</td>' +
                '<td>' + qtyRemaining + '</td>' +
                '<td>' + lineStatus + '</td>' +
                '</tr>';
        }

        htmlBody += '</tbody></table></div>';

        return htmlBody;
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
};

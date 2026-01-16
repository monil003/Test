/**
 * @version v1.0.1
 */

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/search', 'N/runtime'], function(record, log, search, runtime) {

  const LOSS_AND_CONTROL_SUBSIDIARY_ID = 72;
  const ROYALTY_ITEM_ID = 636; // 636 or 3353
  const CAREER_PLUG_ITEM_ID = 6860;
  const NAF_ADMIN_ACCOUNT_ID = 864;
  const NAF_ADMIN_ITEM_ID = 1644;
  const NAF_ITEM_ID = 621; //621 or 6847
  const ADMIN_FEE_ITEM_ID = 1515;
  const CAD_CURRENCY_ID = 3;
  const ROYALTIES_CAD_ID = 3353;

  //Additional Account Mapping Items
  const CAREERPLUG_6228 = 6228;
  const MEDIA_ITEM = 618;
  const ROYALTY_ITEM_636 = 636;
  const ROYALTY_VARIABLE_ITEM = 6226;
  const ROYALTY_VARIABLE_USD_ITEM = 6225;

  const ACCOUNT_MAP = { 
    "6860": "custscript_careerplug_6228", 
    "618": "custscript_media_618", 
    "621": "custscript_naf_621", 
    "1644": "custscript_naf_a_1644", 
    "636": "custscript_royalties_636", 
    "3353": "custscript_royalties_cad_3353", 
    "6226": "custscript_royalties_cad_variable_6226", 
    "6225": "custscript_royalties_usd_variable_6225" 
  }

  function afterSubmit(context) {
    try {
      if (context.type === context.UserEventType.DELETE) return;

      var newRec = context.newRecord;
      var date = newRec.getValue('trandate');
      
      log.debug('date',date)
      var recId = newRec.id;
      var invoice = record.load({ type: record.Type.INVOICE, id: recId, isDynamic: true });

      var billAccount = invoice.getValue({ fieldId: 'billingaccount' });
      var invoiceCustomer = invoice.getText('entity') || '';
      var invoiceCustomerId = invoice.getValue('entity') || '';
      var invoiceDate = invoice.getText('trandate') || '';

      var subsidiary = invoice.getValue('subsidiary');
      var adminFees = 0;
      
      if (subsidiary == LOSS_AND_CONTROL_SUBSIDIARY_ID) {
        adminFees = removeAndMergeAdminFee(invoice);

        if (adminFees > 0) {
          invoice.selectLine({ sublistId: 'item', line: 0 });

          invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_admin_fees', value: adminFees });

          invoice.commitLine({ sublistId: 'item' });

          var firstItemText = invoice.getSublistText({
            sublistId: 'item',
            fieldId: 'item',
            line: 0
          });

          let mappingCodeForAdminItem = getMappedCode(firstItemText);

          if (mappingCodeForAdminItem) {
            var adminFeeInvoiceDocNum = customizeInvoiceNumber(invoiceCustomer, mappingCodeForAdminItem, invoiceDate);

            if (adminFeeInvoiceDocNum) {
              invoice.setValue({
                fieldId: 'tranid',
                value: adminFeeInvoiceDocNum
              });
            }
          }

          invoice.setValue({ fieldId: 'approvalstatus', value: 2 });

          invoice.setValue({ fieldId: 'trandate', value: new Date(invoiceDate) });

          invoice.save({ enableSourcing: true, ignoreMandatoryFields: false });
        }
      }
      
      // if (!billAccount) return;

      //Step 1: Gather all line data BEFORE any modification
      var allLines = [];
      var chargeIdsToUpdate = [];
      var count = invoice.getLineCount({ sublistId: 'item' });
      var invoiceTotalIs = 0;

      for (var i = 0; i < count; i++) {
        var chargeId = invoice.getSublistValue({ sublistId: 'item', fieldId: 'charge', line: i });

        var itemId = invoice.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
        var rate = parseFloat(invoice.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i }) || 0);

        var updateRate = rate;

        if (itemId == ADMIN_FEE_ITEM_ID) continue;

        if (itemId == ROYALTY_ITEM_ID && chargeId) {
          var chargeLookup = search.lookupFields({
            type: 'charge',
            id: chargeId,
            columns: ['custrecord_hfc_customer_sales']
          });

          log.debug('chargeLookup', chargeLookup);

          if (chargeLookup.custrecord_hfc_customer_sales) {
            var salesValue = parseFloat(chargeLookup.custrecord_hfc_customer_sales || 0);
            var calculatedRate = Math.round(salesValue * 0.035 * 100) / 100;

            log.debug('Rate Calculation', {
              line: i,
              originalRate: rate,
              salesValue: salesValue,
              calculatedRate: calculatedRate
            });

            if (calculatedRate > rate && calculatedRate > 2500) {
              updateRate = calculatedRate
            }
          }
        }

        if (itemId == CAREER_PLUG_ITEM_ID && chargeId) {
          var chargeLookup = search.lookupFields({
            type: 'charge',
            id: chargeId,
            columns: ['custrecord_career_plan_fee']
          });

          log.debug('chargeLookup', chargeLookup);

          if (chargeLookup.custrecord_career_plan_fee) {
            var chargeCareerPlugFee = parseFloat(chargeLookup.custrecord_career_plan_fee || 0);

            if (chargeCareerPlugFee > 0) {
              log.debug('Rate Calculation', {
                line: i,
                originalRate: rate,
                calculatedRate: chargeCareerPlugFee
              });
              updateRate = chargeCareerPlugFee;
            }
          }
        }

        //NAF SPECIAL RATE CALCULATION
        if (itemId == NAF_ITEM_ID && chargeId) {
          var naf_rates = search.lookupFields({
            type: search.Type.CHARGE,
            id: chargeId,
            columns: ['custrecord1393', 'custrecord1394']
          });
          log.debug('naf_rates',naf_rates);

          // var naf_charge = naf_rates.custrecord1393 ? parsePercent(naf_rates.custrecord1393) : naf_rates.custrecord1393;
          // var naf_admin_charge = naf_rates.custrecord1394 ? parsePercent(naf_rates.custrecord1394) : naf_rates.custrecord1394;

          var naf_charge = '';
          var naf_admin_charge = '';

          if (!naf_charge && !naf_admin_charge) {
            const nafLookupSubsidiary = getNAFFromSubsidiary(subsidiary);

            log.debug('nafLookupSubsidiary', nafLookupSubsidiary);

            naf_charge = nafLookupSubsidiary.NAFPercent;
            naf_admin_charge = nafLookupSubsidiary.NAFAdminPercent;

            if (nafLookupSubsidiary.NAFPercent && nafLookupSubsidiary.NAFAdminPercent) {
              naf_charge = naf_charge ? parsePercent(naf_charge) : null;
              naf_admin_charge = naf_admin_charge ? parsePercent(naf_admin_charge) : null;
            }
          }

          if (naf_charge && naf_admin_charge && rate) {
            
            var nafCalculatedRate = (rate * naf_charge) / 100;
            var adminNAFCalculatedRate = (rate * naf_admin_charge) / 100;
            
            log.debug('nafCalculatedRate', nafCalculatedRate);
            log.debug('adminNAFCalculatedRate', adminNAFCalculatedRate);

            if (!nafCalculatedRate && !adminNAFCalculatedRate) continue;

            updateRate = nafCalculatedRate;

            const nafQty = invoice.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }) || 1;

            var nafAdminAmount = adminNAFCalculatedRate * parseFloat(nafQty)

            allLines.push({
              line: i,
              itemId: NAF_ADMIN_ITEM_ID,
              itemText: invoice.getSublistText({ sublistId: 'item', fieldId: 'item', line: i }),
              quantity: invoice.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }) || 1,
              rate: adminNAFCalculatedRate || 0,
              charge: chargeId,
              department: invoice.getSublistValue({ sublistId: 'item', fieldId: 'department', line: i }),
              amount: nafAdminAmount ? nafAdminAmount : invoice.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }) || 0
            });
          }
        }

        if (chargeId && chargeIdsToUpdate.indexOf(chargeId) == -1) {
          chargeIdsToUpdate.push(chargeId)
        }

        var quantityIs = invoice.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }) || 1

        var amountIs = (parseFloat(updateRate) * parseFloat(quantityIs));

        invoiceTotalIs += amountIs; 
        
        allLines.push({
          line: i,
          itemId: invoice.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i }),
          itemText: invoice.getSublistText({ sublistId: 'item', fieldId: 'item', line: i }),
          quantity: invoice.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }) || 1,
          rate: updateRate || 0,
          charge: chargeId,
          department: invoice.getSublistValue({ sublistId: 'item', fieldId: 'department', line: i }),
          amount: amountIs ? amountIs : invoice.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }) || 0
        });
      }

      if (invoiceTotalIs == 0) {
        deleteTotalZeroInvoices(invoice, recId)
      }
      
      log.debug('allLines', allLines);

      //Step 2: Group by unique item
      var itemGroups = {};
      allLines.forEach(function(line) {
        if (!itemGroups[line.itemId]) itemGroups[line.itemId] = [];
        itemGroups[line.itemId].push(line);
      });

      var uniqueItemIds = Object.keys(itemGroups);

      var stringItemIds = uniqueItemIds.map(function(id) { return id.toString(); });

      if (stringItemIds.length === 2 &&
        stringItemIds.indexOf(NAF_ITEM_ID.toString()) !== -1 &&
        stringItemIds.indexOf(NAF_ADMIN_ITEM_ID.toString()) !== -1) {
    
        log.audit('Special Case Detected', 'NAF + NAF Admin items found on original invoice');
      
        // --- Get NAF line details from allLines ---
        var nafLineData = null;
        var nafAdminLines = [];
        for (var a = 0; a < allLines.length; a++) {
          if (allLines[a].itemId == NAF_ITEM_ID) {
            nafLineData = allLines[a];

          }

          if (allLines[a].itemId == NAF_ADMIN_ITEM_ID) {
            nafAdminLines.push(allLines[a]);
          }
        }
      
        if (nafLineData) {
          log.debug('Rebuilding NAF line', nafLineData);
      
          // --- Remove existing NAF line ---
          var lineCount = invoice.getLineCount({ sublistId: 'item' });
          for (var i = lineCount - 1; i >= 0; i--) {
            var itemId = invoice.getSublistValue({
              sublistId: 'item',
              fieldId: 'item',
              line: i
            });
            if (itemId == NAF_ITEM_ID) {
              invoice.removeLine({
                sublistId: 'item',
                line: i,
                ignoreRecalc: true
              });
              log.debug('Removed old NAF line', i);
            }
          }
      
          // --- Reinsert NAF line with updated values ---
          invoice.selectNewLine({ sublistId: 'item' });
          invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: nafLineData.itemId
          });
          invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: nafLineData.quantity
          });
          invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'rate',
            value: nafLineData.rate
          });
          invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
            value: nafLineData.amount
          });

          if (nafLineData.charge) {
            invoice.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_non_billable_charge',
              value: nafLineData.charge
            });
          }
      
          var trandate = invoice.getValue('trandate');
          var formattedDate = formatDate(trandate);
          var newDesc = (nafLineData.itemText || '') + ' - ' + formattedDate;
      
          invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'description',
            value: newDesc
          });
      
          invoice.commitLine({ sublistId: 'item' });
          log.debug('Reinserted updated NAF line');
        }

        var customerName = invoice.getText('entity') || '';

        if (customerName) {
          var docuNum = customizeInvoiceNumber(customerName, 'NAF', invoiceDate);

          if (docuNum) {
            invoice.setValue({
              fieldId: 'tranid',
              value: docuNum
            });
          }
        }

        invoice.setValue({ fieldId: 'approvalstatus', value: 2 });
        invoice.setValue({ fieldId: 'trandate', value: new Date(invoiceDate) });

        var nafInvoiceAcc = getAccountFromItem(NAF_ITEM_ID);

        if (nafInvoiceAcc) {
          log.debug('Set NAF Item Account', nafInvoiceAcc);
          invoice.setValue({ fieldId: 'account', value: nafInvoiceAcc });
        }
      
        // --- Save updated original invoice ---
        var updatedInvoiceId = invoice.save({ enableSourcing: true, ignoreMandatoryFields: false });
        log.audit('Updated Original Invoice (NAF only)', updatedInvoiceId);
      
        if (nafAdminLines.length > 0) {
          var newInvId = createInvoiceForItem(invoice, NAF_ADMIN_ITEM_ID, nafAdminLines, invoiceDate);
          log.audit('Created NAF Admin invoice', newInvId);
        }
      
        // --- Update charge stage if applicable ---
        if (chargeIdsToUpdate && chargeIdsToUpdate.length) {
          updateChargesToNonBillable(chargeIdsToUpdate);
        }
      
        log.audit('Special NAF Split Completed', {
          sourceInvoice: recId,
          updatedOriginalInvoice: updatedInvoiceId,
          createdInvoices: nafAdminLines.length > 0 ? [newInvId] : []
        });
      
        return; // Exit normal flow
      }

      log.debug('uniqueItemIds', uniqueItemIds);

      if (uniqueItemIds.length <= 1) {
        log.audit('Only one unique item found, skipping split');

        if (uniqueItemIds[0] == ROYALTIES_CAD_ID || uniqueItemIds[0] == ROYALTY_VARIABLE_ITEM) {
          log.debug('Sales invoice with one line of Royalty');
          const customerCurrency = getCustomerPrimaryCurrency(invoiceCustomerId);

          if (customerCurrency == CAD_CURRENCY_ID) {
            addRoyaltyTaxHoldingItem(invoice, 1, true);
          }

          var customerIs = invoice.getText('entity') || '';

          var royDocNum = customizeInvoiceNumber(customerIs, 'ROY', invoiceDate);

          if (royDocNum) {
            invoice.setValue({
              fieldId: 'tranid',
              value: royDocNum
            });
          }

          var royAccount = getAccountFromItem(ROYALTY_ITEM_ID);

          if (royAccount) {
            invoice.setValue({ fieldId: 'account', value: royAccount });
          }

          try {
                 setInvoiceMemo('ROY', invoice);
              } catch (error) {
                log.debug('error in memo', error);
              }

          invoice.setValue({ fieldId: 'approvalstatus', value: 2 });
          invoice.setValue({ fieldId: 'trandate', value: new Date(invoiceDate) });

          invoice.save({ enableSourcing: true, ignoreMandatoryFields: false });

        }

        if (adminFees > 0) {
          invoice.selectLine({ sublistId: 'item', line: 0 });

          invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_admin_fees', value: adminFees });

          invoice.commitLine({ sublistId: 'item' });

          var firstItemText = invoice.getSublistText({
            sublistId: 'item',
            fieldId: 'item',
            line: 0
          });

          try {
              setInvoiceMemo(firstItemText, invoice);
          } catch (error) {
             log.debug('error in setting up memo', error);
          }

          let mappingCodeForAdminItem = getMappedCode(firstItemText);

          if (mappingCodeForAdminItem) {
            var adminFeeInvoiceDocNum = customizeInvoiceNumber(invoiceCustomer, mappingCodeForAdminItem, invoiceDate);

            if (adminFeeInvoiceDocNum) {
              invoice.setValue({
                fieldId: 'tranid',
                value: adminFeeInvoiceDocNum
              });
            }
          }

          var adminInvAcc = getAccountFromItem(uniqueItemIds[0]);

          if (adminInvAcc) {
            log.debug('admin inv', adminInvAcc);
            invoice.setValue({ fieldId: 'account', value: adminInvAcc });
          }

          invoice.setValue({ fieldId: 'approvalstatus', value: 2 });

          invoice.setValue({ fieldId: 'trandate', value: new Date(invoiceDate) });

          invoice.save({ enableSourcing: true, ignoreMandatoryFields: false });
        }

        if (uniqueItemIds[0] != ROYALTY_ITEM_ID && adminFees == 0) {
         var firstItemText = invoice.getSublistText({
          sublistId: 'item',
          fieldId: 'item',
          line: 0
         });

          let mappingCodeForAdminItem = getMappedCode(firstItemText);

          if (mappingCodeForAdminItem) {
            var adminFeeInvoiceDocNum = customizeInvoiceNumber(invoiceCustomer, mappingCodeForAdminItem, invoiceDate);

            if (adminFeeInvoiceDocNum) {
              invoice.setValue({
                fieldId: 'tranid',
                value: adminFeeInvoiceDocNum
              });

              var orgInvAccNum = getAccountFromItem(uniqueItemIds[0]);

              if (orgInvAccNum) {
               invoice.setValue({ fieldId: 'account', value: orgInvAccNum });
              }

              try {
                 setInvoiceMemo(firstItemText, invoice);
              } catch (error) {
                log.debug('error in memo', error);
              }

              invoice.setValue({ fieldId: 'approvalstatus', value: 2 });
              
              invoice.setValue({ fieldId: 'trandate', value: new Date(invoiceDate) });
              invoice.save({ enableSourcing: true, ignoreMandatoryFields: false });
           }
          } 
        }
        
        
        return;
      }

      // Step 3: Keep first unique item on original invoice
      var firstLineItem = invoice.getSublistValue({ sublistId: 'item', fieldId: 'item', line: 0 });
      var itemToKeep = firstLineItem ? firstLineItem.toString() : null;
      var itemsToSplit = uniqueItemIds.filter(function(id) { return id.toString() !== itemToKeep; });

      log.debug('itemToKeep', itemToKeep);
      log.debug('itemsToSplit', itemsToSplit);

      // Remove other items from original invoice
      for (var i = invoice.getLineCount({ sublistId: 'item' }) - 1; i >= 0; i--) {
        // var itemId = invoice.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
        // if (itemsToSplit.indexOf(itemId.toString()) !== -1) {
        //   invoice.removeLine({ sublistId: 'item', line: i, ignoreRecalc: false });
        // }
        invoice.removeLine({
          sublistId: 'item',
          line: i,
          ignoreRecalc: true
        });

        log.debug('here');
      }

      var keptLines = allLines.filter(function(line) {
        return line.itemId.toString() === itemToKeep;
      });

      log.debug('keptLines', keptLines);

      keptLines.forEach(function(line) {

        invoice.selectNewLine({ sublistId: 'item' });
    
        invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: line.itemId
        });
    
        invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: line.quantity
        });
    
        invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'rate',
            value: line.rate
        });
    
        invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
            value: line.amount
        });
    
        if (line.charge) {
            invoice.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_non_billable_charge',
                value: line.charge
            });
        }

        if (line.department) {
            invoice.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'department',
                value: line.department
            });
        }

        if (line.itemText) {
          try {
              setInvoiceMemo(line.itemText, invoice);
          } catch (error) {
             log.debug('error in setting up memo', error);
          }
        }
    
        invoice.commitLine({ sublistId: 'item' });
      });

      var originalLineCount = invoice.getLineCount({ sublistId: 'item' });
      var royaltyCountOriginal = 0;
      var nafAdminOnOriginalInv = false;
      var orgInvItemText = '';

      log.debug('originalLineCount', originalLineCount);

      for (var i = 0; i < originalLineCount; i++) {
        var itemId = invoice.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
        if (itemId == ROYALTIES_CAD_ID || itemId == ROYALTY_VARIABLE_ITEM) {
          royaltyCountOriginal++;
        }

        if (itemId == NAF_ADMIN_ITEM_ID) {
          nafAdminOnOriginalInv = true;
        }

        orgInvItemText = invoice.getSublistText({
          sublistId: 'item',
          fieldId: 'item',
          line: i
        });
      }

      // If there’s at least one Royalty item, add 6967 accordingly
      if (royaltyCountOriginal > 0) {
        const customerCurrency = getCustomerPrimaryCurrency(invoiceCustomerId);

        if (customerCurrency == CAD_CURRENCY_ID) {
            addRoyaltyTaxHoldingItem(invoice, royaltyCountOriginal);
        }
        // addRoyaltyTaxHoldingItem(invoice, royaltyCountOriginal);
      }

      var orgInvAcc = getAccountFromItem(itemToKeep);

      if (orgInvAcc) {
        log.debug('orgInvAcc update', { orgInvAcc: orgInvAcc, itemToKeep: itemToKeep })
        invoice.setValue({
          fieldId: 'account',
          value: orgInvAcc
        });
      }

      // Set Account for NAF Admin item invoice
      if (nafAdminOnOriginalInv) {
        invoice.setValue({
          fieldId: 'account',
          value: NAF_ADMIN_ACCOUNT_ID
        });
      }

      if (adminFees > 0) {
        var currentRate = parseFloat(invoice.getSublistValue({
          sublistId: 'item',
          fieldId: 'rate',
          line: 0
        })) || 0;

        log.debug('adminFees', adminFees);
        log.debug('currentRate', currentRate);

        var newRateIs = currentRate + adminFees;

        invoice.selectLine({ sublistId: 'item', line: 0 });

        // invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: newRateIs });
        invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_admin_fees', value: adminFees });

        invoice.commitLine({ sublistId: 'item' });
      }

      // Set Customize Invoice Number for Original Invoice
      var originalInvEntity = invoice.getText('entity') || '';
      var mappedCode = getMappedCode(orgInvItemText);

      log.debug('originalInvEntity', originalInvEntity);
      log.debug('mappedCode', mappedCode);
      
      if (originalInvEntity && mappedCode) {
        var customOrgInvNum =  customizeInvoiceNumber(originalInvEntity, mappedCode, invoiceDate);

        if (customOrgInvNum) {
          log.debug('customOrgInvNum', customOrgInvNum);
          invoice.setValue({
            fieldId: 'tranid',
            value: customOrgInvNum
          });
        }
      }

      invoice.setValue({ fieldId: 'approvalstatus', value: 2 });
      invoice.setValue({ fieldId: 'trandate', value: new Date(invoiceDate) });

      var updatedInvoiceId = invoice.save({ enableSourcing: true, ignoreMandatoryFields: false });
      log.audit('Updated Original Invoice', updatedInvoiceId);

      //Step 4: Create new invoices for each remaining unique item
      var createdInvoices = [];
      itemsToSplit.forEach(function(itemId) {
        var newInvId = createInvoiceForItem(invoice, itemId, itemGroups[itemId], invoiceDate);
        createdInvoices.push(newInvId);
      });

      if (chargeIdsToUpdate.length) {
        updateChargesToNonBillable(chargeIdsToUpdate);
      }

      log.audit('Invoice Split Completed', {
        sourceInvoice: recId,
        updatedOriginalInvoice: updatedInvoiceId,
        createdInvoices: createdInvoices
      });

    } catch (e) {
      log.error('Error in afterSubmit', e);
    }
  }

  function createInvoiceForItem(originalInv, itemId, itemLines, invoiceDate) {
    try {
      var newInv = record.create({ type: record.Type.INVOICE, isDynamic: true });

      // Copy header fields
      ['entity', 'subsidiary', 'location', 'department', 'class'].forEach(function(field) {
        var val = originalInv.getValue(field);
        if (val) newInv.setValue(field, val);
      });

      const invoiceCustomerId = originalInv.getValue('entity') || '';

      let headerMemo = '';

      // Add new lines from stored data
      itemLines.forEach(function(lineData) {
        newInv.selectNewLine({ sublistId: 'item' });
        newInv.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: lineData.itemId });
        newInv.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: lineData.quantity });
        newInv.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: lineData.rate });
        newInv.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: lineData.amount });

        if (lineData.charge) {
          newInv.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_non_billable_charge', value: lineData.charge });
        }

        if (lineData.department) {
          newInv.setCurrentSublistValue({ sublistId: 'item', fieldId: 'department', value: lineData.department });
        }

        var trandate = originalInv.getValue('trandate');
        var formattedDate = formatDate(trandate);
        var newDesc = (lineData.itemText || '') + ' - ' + formattedDate;

        if (newDesc) {
          headerMemo = newDesc;
        }

        newInv.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: newDesc });
        newInv.commitLine({ sublistId: 'item' });
      });

      try {
        if (headerMemo) newInv.setValue({ fieldId: 'memo', value: headerMemo });  
      } catch (error) {
        log.debug('error setting header memo', error);
      }

      // Custom invoice number
      var entityText = originalInv.getText('entity') || '';
      var dateObj = new Date(originalInv.getValue('trandate'));
      var month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
      var year = dateObj.getFullYear();
      var mappedCode = getMappedCode(itemLines[0].itemText);

      if (entityText) {
        entityText = entityText.split(' ')[0];
      }
      var customInvNum = entityText + '-' + month + '.' + year + (mappedCode ? '-' + mappedCode : '');

      var itemAccount = getAccountFromItem(itemId);

      log.debug('itemAccount for new created', { itemAccount: itemAccount, itemId: itemId });

      if (itemAccount) {
        newInv.setValue({
          fieldId: 'account',
          value: itemAccount
        });
      }

      if (itemId == NAF_ADMIN_ITEM_ID) {
        newInv.setValue({
          fieldId: 'account',
          value: NAF_ADMIN_ACCOUNT_ID
        });
        customInvNum = entityText + '-' + month + '.' + year + (mappedCode ? '-A-' + mappedCode : '');
      }

      newInv.setValue({ fieldId: 'tranid', value: customInvNum });

      if (itemId == ROYALTIES_CAD_ID || itemId == ROYALTY_VARIABLE_ITEM) {
        const customerCurrency = getCustomerPrimaryCurrency(invoiceCustomerId);

        if (customerCurrency == CAD_CURRENCY_ID) {
            addRoyaltyTaxHoldingItem(newInv, itemLines.length);
        }
       // addRoyaltyTaxHoldingItem(newInv, itemLines.length);
      }

      newInv.setValue({ fieldId: 'approvalstatus', value: 2 });

      if (invoiceDate) {
        newInv.setValue({ fieldId: 'trandate', value: new Date(invoiceDate) });
      }

      var newId = newInv.save({ enableSourcing: true, ignoreMandatoryFields: false });
      log.audit('Created new invoice', { itemId: itemId, invoiceId: newId });
      return newId;

    } catch (err) {
      log.error('Error in createInvoiceForItem', err);
    }
  }

  function updateChargesToNonBillable(chargeIdsToUpdate) {
    chargeIdsToUpdate.forEach(function(id) {
      try {
        record.submitFields({
          type: 'charge',
          id: id,
          values: { stage: 'NON_BILLABLE' },
          options: { enableSourcing: false, ignoreMandatoryFields: true }
        });
        log.debug('Updated Charge to NON_BILLABLE Charge ID: ', id);
      } catch (e) {
        log.error('Error updating charge stage', { chargeId: id, error: e });
      }
    });
  }

  function customizeInvoiceNumber(entity, code, invoiceDate) {
      log.debug('invoiceDate in custom num', invoiceDate);
      var dateObj = invoiceDate ? new Date(invoiceDate) : new Date();
      var month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
      var year = dateObj.getFullYear();

      var suffix = '-' + month + '.' + year + '-' + code; // always keep this
      var entityPart = '';

      if (entity) {
         // Take only the first part of entity before any space
         entityPart = entity.split(' ')[0];
      }

      var customDocNum = entityPart ? entityPart + suffix : suffix;

      log.debug('customDocNum', customDocNum);

      return customDocNum;
  }

  function getMappedCode(itemName) {
    if (!itemName) return '';
    var lower = itemName.toLowerCase();
    if (lower.substring(0, 3) === 'roy') return 'ROY';
    if (itemName === 'Career Plug') return 'CP';
    if (itemName === 'NAF') return 'NAF';
    if (itemName === 'MEDIA') return 'TECH';
    return '';
  }

  function formatDate(dateObj) {
    if (!dateObj) return '';
    var m = dateObj.getMonth() + 1;
    var d = dateObj.getDate();
    var y = dateObj.getFullYear();
    if (m < 10) m = '0' + m;
    if (d < 10) d = '0' + d;
    return m + '.' + d + '.' + y;
  }

  // Merge Admin Fee into valid line
  function removeAndMergeAdminFee(invRec) {
        try {
            const ADMIN_ITEM_ID = 1515;
            var adminFeeTotal = 0;
            var validLineIndex = -1;

            var lineCount = invRec.getLineCount({ sublistId: 'item' });
            log.debug('Initial Line Count', lineCount);

            // Step 1: Loop backward to remove admin fee
            for (var i = lineCount - 1; i >= 0; i--) {
                var itemId = invRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });
                var amount = parseFloat(invRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: i
                })) || 0;

                log.debug('itemId', itemId);

                if (itemId == ADMIN_ITEM_ID) {
                    adminFeeTotal += amount;

                    // log.debug('Removing Admin Fee line', 'Line: ' + i + ', Amount: ' + amount);

                    // invRec.removeLine({
                    //     sublistId: 'item',
                    //     line: i,
                    //     ignoreRecalc: true
                    // });
                } else {
                    if (validLineIndex === -1) {
                        validLineIndex = i;
                    }
                }
            }

            return adminFeeTotal;

        } catch (e) {
            log.error('Error in removeAndMergeAdminFee', e);
        }
    }

  //Add Tax Holding Item
  function addRoyaltyTaxHoldingItem(invoice, royaltyCount, specialCase) {
    if (royaltyCount <= 0) return;

    // Count how many "6967" items already exist
    var existingCount = 0;
    var newRoyCount = 0
    var lineCount = invoice.getLineCount({ sublistId: 'item' });
    for (var i = 0; i < lineCount; i++) {
      var itemId = invoice.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
      if (itemId == 6967) existingCount++;
      if (itemId == ROYALTY_ITEM_ID) newRoyCount++;
    }

    if (specialCase) {
      royaltyCount = newRoyCount
    }

    log.debug('newRoyCount', newRoyCount);
    log.debug('royaltyCount', royaltyCount);

    var toAdd = royaltyCount - existingCount;
    if (toAdd <= 0) {
      log.debug('Skipped adding item 6967');
      return;
    }

    for (var j = 0; j < toAdd; j++) {
      invoice.selectNewLine({ sublistId: 'item' });
      invoice.setCurrentSublistValue({
        sublistId: 'item',
        fieldId: 'item',
        value: 6967
      });

      try {
        var dateIs = invoice.getValue('trandate');
        
        if (dateIs) {
          dateIs = formatDate(new Date(dateIs));
          var desc = `TAX WITHHOLDING - ${dateIs}`;

          invoice.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'description',
            value: desc
          });
        }
      } catch (error) {
        log.debug('error formating tax withholding description', error);
      }
      
      invoice.commitLine({ sublistId: 'item' });
    }

    log.debug('Added item 6967');
  }

  function getAccountFromItem(itemId) {
    try {
      const scriptObj = runtime.getCurrentScript();
      const paramId = ACCOUNT_MAP[itemId];

      if (!paramId) {
        log.debug('No mapping found for item', itemId);
        return null;
      }

      const accountId = scriptObj.getParameter({ name: paramId });

      log.debug(`Item ${itemId} mapped to param ${paramId}, account value: ${accountId}`);
      return accountId;

    } catch (e) {
      log.error('Error fetching account', e);
      return null;
    }
  }

  function parsePercent(val, defaultVal) {
     if (!val) return defaultVal; // fallback
     return parseFloat(val.toString().replace('%', '').trim());
  }

  function getNAFFromSubsidiary(subsidiaryId) {
    const subData = search.lookupFields({
      type: search.Type.SUBSIDIARY,
      id: subsidiaryId,
      columns: ['custrecord_hfc_nafpercent', 'custrecord1395']
    });

    const NAFPercent = subData.custrecord_hfc_nafpercent || '';
    const NAFAdminPercent = subData.custrecord1395 || '';

    log.debug('NAF %', NAFPercent);
    log.debug('NAF Admin %', NAFAdminPercent);

    return {
      NAFPercent: NAFPercent,
      NAFAdminPercent: NAFAdminPercent
    }
  }

  function setInvoiceMemo(itemText, invoice) {
        if (!itemText) return false;

        const transDate = invoice.getText('trandate') || '';
        const formattedDate = formatDate(new Date(transDate));

        var newDesc = (itemText || '') + ' - ' + formattedDate;

        if (newDesc) invoice.setValue({ fieldId: 'memo', value: newDesc });

        return newDesc;
    }

  function getCustomerPrimaryCurrency(customerId) {
    if (!customerId) return null;

    const currencyLookup = search.lookupFields({
        type: record.Type.CUSTOMER,
        id: customerId,
        columns: ['currency']
    });

    log.debug('currencyLookup', currencyLookup);

    if (currencyLookup && currencyLookup.currency && currencyLookup.currency.length > 0) {
        log.debug('return val', currencyLookup.currency[0].value);
        return currencyLookup.currency[0].value;
    }

    return null;
}

  function deleteTotalZeroInvoices(invoice, recId) {
    try {
            record.delete({
                    type: record.Type.INVOICE,
                    id: recId
                });

                log.audit('Invoice Deleted because total = 0');
                return;
        } catch (error) {
            log.debug('Zero amount invoice deletion error', error)
        }
  }

  return { afterSubmit: afterSubmit };
});

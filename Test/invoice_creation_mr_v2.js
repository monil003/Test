/**
        * @version v1.0.1
        */

        /**
* @NApiVersion 2.1
* @NScriptType MapReduceScript
*/
define(['N/record', 'N/search', 'N/log', 'N/runtime'], function (record, search, log, runtime) {

    const LOSS_AND_CONTROL_SUBSIDIARY_ID = 72;
    const ROYALTY_ITEM_ID = 636;
    const ROYALTIES_CAD_ID = 3353;
    const ROYALTIES_CAD_VAR_ID = 6226;
    const ROYALTIES_USD_VAR_ID = 6225;
    const CAREER_PLUG_ITEM_ID = 6860;
    const NAF_ADMIN_ACCOUNT_ID = 864;
    const NAF_ADMIN_ITEM_ID = 1644;
    const NAF_ITEM_ID = 621;
    const MEDIA_ITEM_ID = 618;
    const ADMIN_FEE_ITEM_ID = 1515;
    const TAX_HOLDING_ITEM = 6967; //6185
    const startDateTime = new Date();

    const ACCOUNT_MAP = {
        "6860": "custscript_career_plug_acc_6228",
        "618": "custscript_media_acc_618",
        "7372": "custscript_media_acc_618",
        "7692": "custscript_media_acc_618",
        "621": "custscript_naf_acc_621",
        "1644": "custscript_naf_admin_acc",
        "636": "custscript_royalties_acc_636",
        "3353": "custscript_royalties_cad_acc",
        "6226": "custscript_royalties_cad_variable_acc",
        "6225": "custscript_royalties_usd_variable_acc"
    }

    function getInputData(context) {
        var scriptParams = runtime.getCurrentScript();
        var selectedInvoicsToBeCreated = JSON.parse(scriptParams.getParameter({ name: 'custscript_invoice_list_' }));

        var updatedList = [];

        selectedInvoicsToBeCreated.forEach(function (entry) {
            if (entry.item == NAF_ITEM_ID) {

                let subsidiary = entry.subsidiary;
                let rate = parseFloat(entry.amount);

                // Fetch NAF % and NAF Admin %
                var nafLookupSubsidiary = getNAFFromSubsidiary(subsidiary);
                var nafPercent = parseFloat(nafLookupSubsidiary.NAFPercent);
                var nafAdminPercent = parseFloat(nafLookupSubsidiary.NAFAdminPercent);

                // Calculated amounts
                var nafCalculatedRate = (rate * nafPercent) / 100;
                var adminNAFCalculatedRate = (rate * nafAdminPercent) / 100;

                if (nafCalculatedRate > 0) {
                    entry.amount = nafCalculatedRate.toFixed(2);
                    updatedList.push(entry);
                }

                // Create a cloned object for admin item
                var adminEntry = JSON.parse(JSON.stringify(entry));

                adminEntry.item = NAF_ADMIN_ITEM_ID;
                adminEntry.department = "10";
                adminEntry.itemText = "NAF.";
                adminEntry.amount = adminNAFCalculatedRate.toFixed(2);

                if (adminNAFCalculatedRate > 0) {
                    updatedList.push(adminEntry);
                }

            } else {
                if (parseFloat(entry.amount) > 0) {
                    updatedList.push(entry);
                }
            }
        });

        log.debug('updatedList', updatedList);

        return updatedList;
    }

    /**
     * Map Stage: Process each invoice line
     */
    function map(context) {
        try {
            var data = JSON.parse(context.value);
            const scriptParamsIs = runtime.getCurrentScript();
            const default_terms = scriptParamsIs.getParameter({ name: 'custscript_terms' }) || 15;

            const customerHaveBillingAcc = checkInvoiceBillingAccountFlag(data.customer, data.invoice_date);

            log.debug('customerHaveBillingAcc', customerHaveBillingAcc);

            // return;

            // Create Invoice
            var invoice = record.create({
                type: record.Type.INVOICE,
                isDynamic: true
            });

            let invoiceDateIs = data.invoice_date ? new Date(data.invoice_date) : new Date();
            const formatDateIs = formatDate(invoiceDateIs);

            log.debug('Billing Account Received:', data.billing_account);

            invoice.setValue({ fieldId: 'entity', value: data.customer });
            invoice.setValue({ fieldId: 'subsidiary', value: data.subsidiary });
            invoice.setValue({ fieldId: 'custbody_billing_account', value: data.billing_account });
            invoice.setValue({ fieldId: 'exchangerate', value: 1 });
            invoice.setValue({ fieldId: 'currency', value: data.currency || null });
            invoice.setValue({ fieldId: 'trandate', value: invoiceDateIs });
            invoice.setValue({ fieldId: 'approvalstatus', value: 2 });
            invoice.setValue({ fieldId: 'custbody_approved', value: true });
            invoice.setValue({ fieldId: 'custbody_custom_suite_billing', value: true });

            if (!customerHaveBillingAcc || data.item == CAREER_PLUG_ITEM_ID) {
                invoice.setValue({ fieldId: 'billingaccount', value: data.billing_account });
            }

            try {
              invoice.setValue({ fieldId: 'terms', value: default_terms });
            } catch (error) {
              log.debug('error in setting up terms');
            }

            var updatedRate = data.amount ? parseFloat(data.amount) : 0;

            updatedRate.toFixed(2);

            if (data.item == ROYALTY_ITEM_ID && data.customer_sales) {
                let royCustomerSalesRate = royaltyItemUpdatedRate(data.customer_sales);

                if (royCustomerSalesRate) {
                    updatedRate = royCustomerSalesRate;
                }
            }

            // Add Line
            invoice.selectNewLine({ sublistId: 'item' });
            invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: data.item });
            invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: data.quantity || 1 });
            invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: updatedRate });
            invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'charge', value: data.charge });

            if (data.charge) {
                invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_non_billable_charge', value: data.charge });
            }

            if (data.department) {
                invoice.setValue({ fieldId: 'department', value: data.department });
                invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'department', value: data.department });
            } else {
                invoice.setValue({ fieldId: 'department', value: 1 });
                invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'department', value: 1 });
            }

            if (data.itemText) {
                const newDesc = (data.itemText || '') + ' - ' + formatDateIs;

                invoice.setValue({ fieldId: 'memo', value: newDesc });
                invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: newDesc });
            }

            invoice.commitLine({ sublistId: 'item' });

            // if (data.item == ROYALTY_ITEM_ID || data.item == ROYALTIES_CAD_ID || data.item == ROYALTIES_CAD_VAR_ID || data.item == ROYALTIES_USD_VAR_ID) {
            //     addRoyaltyTaxHoldingItem(invoice, invoiceDateIs)
            // }

            log.debug('data.item', data.item);
          
            if (data.item == ROYALTIES_CAD_ID || data.item == ROYALTIES_CAD_VAR_ID) {
                log.debug('adding tax holding item')
                addRoyaltyTaxHoldingItem(invoice, invoiceDateIs)
            }

            var itemAccount = data.item == NAF_ADMIN_ITEM_ID ? NAF_ADMIN_ACCOUNT_ID : getAccountFromItem(data.item);

            if (itemAccount) {
                invoice.setValue({ fieldId: 'account', value: itemAccount });
            }

            const docMappingCode = getMappedCode(data.itemText);

            log.debug('docMappingCode', docMappingCode);

            if (data.entityText && docMappingCode) {
                const customInvNumber = customizeInvoiceNumber(data.entityText, docMappingCode, invoiceDateIs);

                log.debug('customInvNumber', customInvNumber);

                if (customInvNumber) {
                    invoice.setValue({ fieldId: 'tranid', value: customInvNumber });
                }
            }

            var invId = invoice.save();
            // var invId = 4652935;
            log.audit('Invoice Created', 'Invoice ID: ' + invId + ' for Charge: ' + data.charge);

            updateChargeToNonBillable(data.charge);

            updateCreatedInvoicesSearch();

            context.write(data.charge, invId);

        } catch (e) {
            log.error('Invoice Creation Failed', e);
        }
    }

    /**
     * Reduce Stage: Optional, could summarize results
     */
    function reduce(context) {
        var charge = context.key;
        var invoiceIds = context.values;
        log.audit('Charges processed', 'Charge: ' + charge + ' => Invoices: ' + invoiceIds.join(', '));

        context.write({ key: charge, value: invoiceIds })
    }

    function summarize(summary) {
        var createdInvoices = [];

        summary.output.iterator().each(function (key, value) {
            const data = JSON.parse(value);
            createdInvoices.push(...data);
            return true;
        });

        log.debug("Invoices created", createdInvoices);

        // Overwrite existing saved search
        updateCreatedInvoicesSearch(createdInvoices);
    }

    function getMappedCode(itemName) {
        if (!itemName) return '';
        var lower = itemName.toLowerCase();
        if (lower.substring(0, 3) === 'roy') return 'ROY';
        if (lower.substring(0, 5) === 'media') return 'TECH';
        if (lower.substring(0, 4) === 'tech') return 'TECH';
        if (itemName === 'Career Plug') return 'CP';
        if (itemName === 'NAF') return 'NAF';
        if (itemName === 'NAF.') return 'NAF-A';
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

    function customizeInvoiceNumber(entity, code, invoiceDate) {
        try {
            var dateObj = invoiceDate ? new Date(invoiceDate) : new Date();
            var month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
            var year = dateObj.getFullYear();

            var customDocNum = '';

            if (entity) {
                try {
                    entity = entity.split(' ')[0];
                } catch (error) {
                    log.debug('error splitting name', entity);
                }
                customDocNum = entity + '-' + month + '.' + year + '-' + code;
            } else {
                customDocNum = month + '.' + year + '-' + code;
            }

            return customDocNum;
        } catch (error) {
            log.debug('error creating custom invoice number', error);
        }
    }

    function addRoyaltyTaxHoldingItem(invoice, invoiceDate) {
        try {
            invoice.selectNewLine({ sublistId: 'item' });
            invoice.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                value: TAX_HOLDING_ITEM
            });

            invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'department', value: 1 });

            let date = invoiceDate ? new Date(invoiceDate) : new Date();
            let formatttedDate = formatDate(date);
            var desc = `TAX WITHHOLDING - ${formatttedDate}`;

            invoice.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: desc });

            invoice.commitLine({ sublistId: 'item' });

        } catch (error) {
            log.debug('error adding tax holding item', error);
        }
    }

    function royaltyItemUpdatedRate(customerSalesAmount) {
        const salesValue = parseFloat(customerSalesAmount);
        const calculatedRate = Math.round(salesValue * 0.035 * 100) / 100;

        if (calculatedRate > rate && calculatedRate > 2500) {
            return calculatedRate;
        } else {
            return 0;
        }
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

    function updateChargeToNonBillable(chargeId) {
        try {
            record.submitFields({
                type: 'charge',
                id: chargeId,
                values: { stage: 'NON_BILLABLE' },
                options: { enableSourcing: false, ignoreMandatoryFields: true }
            });

            log.debug('Charge updated to non billable', chargeId);
        } catch (error) {
            log.debug(`Error making charge non billable, charge Id: ${chargeId}`, error)
        }
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

    function updateCreatedInvoicesSearch(invoiceIds) {
        try {
            var searchId = 'customsearch177888';

            startDateTime.setMinutes(startDateTime.getMinutes() - 2);
            const startDateFormatted = formatDateTimeForNS(startDateTime);

            let endDateTime = new Date();
            endDateTime.setMinutes(endDateTime.getMinutes() + 1);

            const endDateFormatted = formatDateTimeForNS(endDateTime);

            log.debug('DATE RANGE', startDateFormatted + '  ---->  ' + endDateFormatted);

            var s = search.load({ id: searchId });

            s.filters = [
                // search.createFilter({
                //     name: 'type',
                //     operator: search.Operator.ANYOF,
                //     values: ['CustInvc']
                // }),
                // search.createFilter({
                //     name: 'internalid',
                //     operator: search.Operator.ANYOF,
                //     values: invoiceIds
                // }),
                search.createFilter({
                    name: 'context',
                    join: 'systemnotes',
                    operator: search.Operator.ANYOF,
                    values: ['MPR']
                }),
                search.createFilter({
                    name: 'taxline',
                    operator: search.Operator.IS,
                    values: ['F']
                }),
                search.createFilter({
                    name: 'mainline',
                    operator: search.Operator.IS,
                    values: ['F']
                }),
                search.createFilter({
                    name: 'datecreated',
                    operator: search.Operator.WITHIN,
                    values: [startDateFormatted, endDateFormatted]
                }),
            ];

            s.save();

            // log.audit("Saved Search Updated", "Updated search " + searchId + " with invoice IDs: " + invoiceIds.join(', '));

        } catch (e) {
            log.error("Failed Updating Saved Search", e);
        }
    }

    function checkInvoiceBillingAccountFlag(customerId, invoiceDate) {

        // Parse month start & end
        var d = new Date(invoiceDate);
        var firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);

        log.debug('invoiceDate', invoiceDate);
        log.debug('firstDay', firstDay);
        log.debug('lastDay', lastDay);

        function formatDate(dt) {
            return (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear();
        }

        var invoiceSearchObj = search.create({
            type: "invoice",
            filters: [
                ["type", "anyof", "CustInvc"],
                "AND",
                ["customermain.internalid", "anyof", customerId],
                "AND",
                ["item", "anyof", ROYALTY_ITEM_ID, NAF_ITEM_ID, NAF_ADMIN_ITEM_ID, CAREER_PLUG_ITEM_ID, MEDIA_ITEM_ID],
                "AND",
                ["trandate", "within", formatDate(firstDay), formatDate(lastDay)],
                "AND",
                ["billingaccount", "noneof", "@NONE@"]
            ],
            columns: [
                search.createColumn({ name: "internalid" })
            ]
        });

        var result = invoiceSearchObj.run().getRange({ start: 0, end: 1 });

        log.debug('result', result);

        return result && result.length > 0;
    }

    function formatDateTimeForNS(dt) {
        const month = dt.getMonth() + 1;
        const day = dt.getDate();
        const year = dt.getFullYear();

        let hours = dt.getHours();
        let minutes = dt.getMinutes();
        let ampm = 'am';

        if (hours === 0) {
            hours = 12;
        } else if (hours === 12) {
            ampm = 'pm';
        } else if (hours > 12) {
            hours -= 12;
            ampm = 'pm';
        }

        if (minutes < 10) minutes = '0' + minutes;

        return month + '/' + day + '/' + year + ' ' + hours + ':' + minutes + ' ' + ampm;
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});

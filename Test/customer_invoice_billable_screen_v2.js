/**
 * @version v1.0.1
 */

/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define(['N/ui/serverWidget', 'N/search', 'N/log', 'N/runtime', 'N/redirect', 'N/url', 'N/task', 'N/file', 'N/format'],
    (serverWidget, search, log, runtime, redirect, url, task, file, format) => {

        const ROYALTIES_ITEM_ID = 636;
        const ROYALTIES_CAD_ID = 3353;
        const ROYALTIES_CAD_VAR_ID = 6226;
        const ROYALTIES_USD_VAR_ID = 6225;
        const TECH_ITEM_ID = 5411;
        const NAF_ITEM_ID = 621;
        const MEDIA_OWNER_ITEM_ID = 7692;
        const MEDIA_ITEM_ID = 618;
        const MR_SCRIPT_INTERNAL_ID = 3461; //test

        const SUBCUSTOMER_ITEMS = [NAF_ITEM_ID.toString(), TECH_ITEM_ID.toString(), ROYALTIES_ITEM_ID.toString(), ROYALTIES_CAD_ID.toString(), ROYALTIES_CAD_VAR_ID.toString(), ROYALTIES_USD_VAR_ID.toString()];
        const OWNER_TECH_ITEMS = [MEDIA_OWNER_ITEM_ID.toString(), TECH_ITEM_ID.toString()];
      
        function onRequest(context) {
            try {

                const params = getScriptParams();

                const TECH_FOLDER = params.custscript_owner_tech_folder ? params.custscript_owner_tech_folder : 348820;
                const BBGRAY_SUBCUST_FOLDER = params.custscript_variable_report_folder ? params.custscript_variable_report_folder : 350521;

                const OWNER_TECH_FILE_ID = getLatestFileFromFolder(TECH_FOLDER) || 9388647;
                const SUBCUST_BB_GRAY_FILE_ID = getLatestFileFromFolder(BBGRAY_SUBCUST_FOLDER) || 9390350;
                const TERMS_DEFAULT = params.custscript_terms;
              
                const ROY_STACK =  params.custscript_roy_percent ? parsePercent(params.custscript_roy_percent) : 3.5;
                const NAF_STACK =  params.custscript_naf_percent ? parsePercent(params.custscript_naf_percent) : 1;
                const BBGRAY_STACK =  params.custscript_bbgray_percent ? parsePercent(params.custscript_bbgray_percent) : 3.5;
              
                if (context.request.method === "GET") {
                    const form = serverWidget.createForm({
                        title: "HFC | Invoice Billable Customer Screen V2"
                    });

                    const suiteletUrl = url.resolveScript({
                        scriptId: 'customscript_hfc_v2_custom_invoice_billa',
                        deploymentId: 'customdeploy_hfc_v2_custom_invoice_billa',
                        returnExternalUrl: false
                    });

                    form.addField({
                        id: 'custpage_baseurl',
                        label: 'BASE URL',
                        type: serverWidget.FieldType.TEXT,
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    }).defaultValue = suiteletUrl;

                    form.addFieldGroup({
                        id: 'filtergroup',
                        label: 'Filters'
                    });

                    form.clientScriptModulePath = "SuiteScripts/billable_invoice_client_v2.js";

                    form.addButton({
                        id: 'reset',
                        label: 'Reset',
                        functionName: 'onReset();'
                    });

                    form.addButton({
                        id: 'custpage_open_savedsearch',
                        label: 'Open Created Invoices',
                        functionName: 'openSavedSearch'
                    });

                    var ready = context.request.parameters.ready || 'F';
                    var taskId = context.request.parameters.taskid || '';

                    form.addField({
                        id: 'custpage_taskid',
                        type: serverWidget.FieldType.TEXT,
                        label: 'Task ID'
                    }).defaultValue = taskId;

                    form.addField({
                        id: 'custpage_ready',
                        type: serverWidget.FieldType.TEXT,
                        label: 'Ready Flag'
                    }).defaultValue = ready;

                    form.getField('custpage_taskid').updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });

                    form.getField('custpage_ready').updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });

                    const overLayLoader = form.addField({
                        id: 'custpage_loader',
                        label: 'Loader',
                        type: serverWidget.FieldType.INLINEHTML,
                        container: 'filtergroup'
                    });

                    overLayLoader.defaultValue = `

                    <div id="loadingOverlay" style="
                        display:none;
                        position:fixed;
                        top:0;
                        left:0;
                        width:100%;
                        height:100%;
                        background:rgba(0,0,0,0.4);
                        z-index:9999;
                        text-align:center;
                        color:white;
                        font-size:24px;
                        padding-top:20%;
                    ">
                        Loading...
                    </div>
                    
                    `;

                    // Billing Account Filter
                    const billingAccFld = form.addField({
                        id: 'custpage_billingacc',
                        type: serverWidget.FieldType.SELECT,
                        label: 'Billing Account',
                        source: 'billingaccount',
                        container: 'filtergroup'
                    });

                    const itemFilter = form.addField({
                        id: 'custpage_item_filter',
                        type: serverWidget.FieldType.MULTISELECT,
                        label: 'Item',
                        container: 'filtergroup'
                    });

                    const allowedItems = getAllowedItems(context);

                    itemFilter.addSelectOption({
                        value: '',
                        text: ''
                    });

                    allowedItems.forEach(item => {
                        itemFilter.addSelectOption({
                            value: item.id,
                            text: item.text
                        });
                    });

                    // Customer Filter
                    const custFld = form.addField({
                        id: 'custpage_customer',
                        type: serverWidget.FieldType.SELECT,
                        label: 'Customer',
                        source: 'customer',
                        container: 'filtergroup'
                    });

                    // Subscription Filter
                    const subscriptionFilter = form.addField({
                        id: 'custpage_subscription',
                        type: serverWidget.FieldType.SELECT,
                        label: 'Subscription',
                        source: 'subscription',
                        container: 'filtergroup'
                    });

                    // Created Invoice Date (Mandatory Field)
                    const InvoiceDate = form.addField({
                        id: 'custpage_invoice_date',
                        type: serverWidget.FieldType.DATE,
                        label: 'Sales Invoice Date',
                        container: 'filtergroup'
                    }).isMandatory = true;

                    // Variable Billing Flag
                    const variableBillingFld = form.addField({
                        id: 'custpage_variable_bill',
                        label: 'Is Variable Billing',
                        type: serverWidget.FieldType.CHECKBOX,
                        container: 'filtergroup'
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });

                    variableBillingFld.defaultValue = 'F';

                    // Owner Tech Billing Filter
                    const ownerTechBillingFld = form.addField({
                        id: 'custpage_owner_tech_billing',
                        label: 'Owner Tech Billing',
                        type: serverWidget.FieldType.CHECKBOX,
                        container: 'filtergroup'
                    });

                    ownerTechBillingFld.defaultValue = 'F';

                    // BBGRAY Filter
                    const bbGrayBillingFld = form.addField({
                        id: 'custpage_bbgray_billing',
                        label: 'BBGRAY Billing',
                        type: serverWidget.FieldType.CHECKBOX,
                        container: 'filtergroup'
                    });

                    bbGrayBillingFld.defaultValue = 'F';

                    // Sub-Customer Filter
                    const subCustomerBillingFld = form.addField({
                        id: 'custpage_subcustomer_billing',
                        label: 'Sub Customer Billing',
                        type: serverWidget.FieldType.CHECKBOX,
                        container: 'filtergroup'
                    })
                    // .updateDisplayType({
                    //     displayType: serverWidget.FieldDisplayType.HIDDEN
                    // });

                    subCustomerBillingFld.defaultValue = 'F';

                    // Subsidiary Filter
                    const subsidiaryFld = form.addField({
                        id: 'custpage_subsidiary_filter',
                        type: serverWidget.FieldType.SELECT,
                        label: 'Subsidiary',
                        source: 'subsidiary',
                        container: 'filtergroup'
                    });

                    // const currentMonthRange = getCurrentMonthDateRange();

                    // Bill From Date Filter
                    const billDateFromFld = form.addField({
                        id: 'custpage_date_from',
                        label: 'Bill Date From',
                        type: serverWidget.FieldType.DATE,
                        container: 'filtergroup'
                    });

                    // billDateFromFld.defaultValue = currentMonthRange.from;

                    // Bill To Date Filter
                    const billDateToFld = form.addField({
                        id: 'custpage_date_to',
                        label: 'Bill Date To',
                        type: serverWidget.FieldType.DATE,
                        container: 'filtergroup'
                    });

                    // billDateToFld.defaultValue = currentMonthRange.to;

                    const totalAmountFld = form.addField({
                        id: 'custpage_total_amount',
                        type: serverWidget.FieldType.CURRENCY,
                        label: 'Total Selected Charge Amount',
                        container: 'filtergroup'
                    });

                    totalAmountFld.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.INLINE
                    });

                    totalAmountFld.defaultValue = "0.00";

                    const isVariableCalc = form.addField({
                        id: 'custpage_variable_calc',
                        type: serverWidget.FieldType.CHECKBOX,
                        label: 'Is Variable'
                    }).updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });

                    const pageCountField = form.addField({
                        id: 'custpage_info_header',
                        label: 'Info',
                        type: serverWidget.FieldType.INLINEHTML,
                        container: 'filtergroup'
                    })

                    // Add Sublist
                    const sublist = form.addSublist({
                        id: 'custpage_results',
                        type: serverWidget.SublistType.LIST,
                        label: 'Billable Subscription Lines'
                    });

                    sublist.addMarkAllButtons();

                    sublist.addField({
                        id: 'custpage_select',
                        type: serverWidget.FieldType.CHECKBOX,
                        label: 'Select'
                    });

                    const customerField = sublist.addField({ id: 'custpage_customer_col', type: serverWidget.FieldType.TEXTAREA, label: 'Customer' });

                    const ownerSublistFld = sublist.addField({ id: 'custpage_customer_owner_id', type: serverWidget.FieldType.TEXTAREA, label: 'Owner Id' });

                    const billAccountField = sublist.addField({ id: 'custpage_billingacc_col', type: serverWidget.FieldType.TEXTAREA, label: 'Billing Account' });

                    const subscriptionField = sublist.addField({ id: 'custpage_subscription_col', type: serverWidget.FieldType.TEXTAREA, label: 'Subscription' });

                    const itemField = sublist.addField({ id: 'custpage_item', type: serverWidget.FieldType.TEXTAREA, label: 'Item' });

                    const chargField = sublist.addField({ id: 'custpage_charge_id_display', type: serverWidget.FieldType.TEXTAREA, label: 'Charge ID' });

                    sublist.addField({ id: 'custpage_chargeid', type: serverWidget.FieldType.TEXT, label: 'Charge ID' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    sublist.addField({ id: 'custpage_amount', type: serverWidget.FieldType.CURRENCY, label: 'Charge Amount' });
                    sublist.addField({ id: 'custpage_amount_calculated', type: serverWidget.FieldType.CURRENCY, label: 'Calculated Amount' });
                    sublist.addField({ id: 'custpage_billdate', type: serverWidget.FieldType.DATE, label: 'Bill Date' });
                    sublist.addField({ id: 'custpage_stage', type: serverWidget.FieldType.TEXT, label: 'Stage' });
                    sublist.addField({ id: 'custpage_subsidiary_text', type: serverWidget.FieldType.TEXT, label: 'Subsidiary' });
                    
                    const custTerritory = sublist.addField({ id: 'custpage_cust_territory', type: serverWidget.FieldType.TEXT, label: '# Territory' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    
                    sublist.addField({ id: 'custpage_subsidiary', type: serverWidget.FieldType.TEXT, label: 'Subsidiary' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    sublist.addField({ id: 'custpage_department', type: serverWidget.FieldType.TEXT, label: 'Department' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    sublist.addField({ id: 'custpage_billingacc_col_id', type: serverWidget.FieldType.TEXT, label: 'Billing Account Id' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    sublist.addField({ id: 'custpage_customer_col_id', type: serverWidget.FieldType.TEXT, label: 'Customer Id' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    sublist.addField({ id: 'custpage_item_id', type: serverWidget.FieldType.TEXT, label: 'Item Id' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    sublist.addField({ id: 'custpage_currency', type: serverWidget.FieldType.TEXT, label: 'Currency' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    sublist.addField({ id: 'custpage_entity_text', type: serverWidget.FieldType.TEXT, label: 'Customer Text' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    sublist.addField({ id: 'custpage_item_text', type: serverWidget.FieldType.TEXT, label: 'Item Text' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    sublist.addField({ id: 'custpage_charge_customer_sales', type: serverWidget.FieldType.TEXT, label: 'Customer Sales' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                    // If filters applied → Search & populate results
                    const billingAccVal = context.request.parameters.custpage_billingacc;
                    const customerVal = context.request.parameters.custpage_customer;
                    const subscriptionFilterVal = context.request.parameters.custpage_subscription;
                    const itemFilterVal = context.request.parameters.custpage_item_filter;
                    const subsidiaryFilterVal = context.request.parameters.custpage_subsidiary_filter;
                    let multiSelectItems = itemFilterVal ? itemFilterVal.split(',') : [];
                    const variableBillingFilter = context.request.parameters.custpage_variable_bill;
                    const ownerTechBillingFilter = context.request.parameters.custpage_owner_tech_billing;
                    const bbgrayBillingFilter = context.request.parameters.custpage_bbgray_billing;
                    const subCustomerBillingFilter = context.request.parameters.custpage_subcustomer_billing;

                    log.debug('multiSelectItems', multiSelectItems);

                    let territoryMap = {};
                    let bbMasterReport = [];
                    let bbGrayMap = {};
                    let bbGrayOwnerIds = [];
                    let subCustomersMap = {};
                    let subCustOwnerList = [];

                    // if (variableBillingFilter == 'T') {
                    //   variableBillingFld.defaultValue = 'T';
                    //   ownerTechBillingFld.defaultValue = 'T';
                    //   bbGrayBillingFld.defaultValue = 'T';
                    //   subCustomerBillingFld.defaultValue = 'T';
                    // }

                    if (variableBillingFilter == 'T' || ownerTechBillingFilter == 'T' || bbgrayBillingFilter == 'T' || subCustomerBillingFilter == 'T') {
                      // ownerSublistFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.READONLY });
                      isVariableCalc.defaultValue = 'T';
                    } else {
                      isVariableCalc.defaultValue = 'F';
                    }

                    // BBGRAY BILLING FILTER
                    if (bbgrayBillingFilter == 'T' || variableBillingFilter == 'T') {
                      const BBReportData = readCsvMaster(SUBCUST_BB_GRAY_FILE_ID);

                      bbMasterReport = BBReportData;

                      const bbGrayResult = filterBBReport(BBReportData);

                      if (bbGrayResult.resultMap) {
                        bbGrayMap = bbGrayResult.resultMap
                      }

                      if (bbGrayResult.ownerIdList) {
                        bbGrayOwnerIds = bbGrayResult.ownerIdList
                      }

                      bbGrayBillingFld.defaultValue = 'T';  
                    }

                    // OWNER TECH BILLLING FILTER
                    if (variableBillingFilter == 'T' || ownerTechBillingFilter == 'T') {
                      custTerritory.updateDisplayType({ displayType: serverWidget.FieldDisplayType.NORMAL });

                      ownerTechBillingFld.defaultValue = 'T';

                      try {
                        const techCSVData = readCsvMaster(OWNER_TECH_FILE_ID, true);

                        if (techCSVData) {
                          techCSVData.forEach(r => {
                            if (r.ownernumber) {
                              territoryMap[r.ownernumber] = r.territories || 0;
                            }
                          });
                        } 
                      } catch (error) {
                        log.debug('error in csv reader', error);
                      }
                    } else {
                      custTerritory.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    }

                    //SUBCUSTOMER BILLING FILTER
                    if (subCustomerBillingFilter == 'T' || variableBillingFilter == 'T') {

                      let csvData;
                      if (!bbMasterReport.length) {
                         csvData = readCsvMaster(SUBCUST_BB_GRAY_FILE_ID);
                      } else {
                        csvData = bbMasterReport;
                      }

                      const subCustomersList = filterBBReport(csvData);

                      if (subCustomersList.subCustomers) {
                        subCustomersMap = subCustomersList.subCustomers;
                      }

                      if (subCustomersList.subCustomersOwnerIds) {
                        subCustOwnerList = subCustomersList.subCustomersOwnerIds;
                      }
                    }

                    // log.debug('territoryMap', territoryMap);
                    // log.debug('bbGrayMap', bbGrayMap);
                    // log.debug('bbGrayOwnerIds', bbGrayOwnerIds);
                    // log.debug('subCustomersMap', subCustomersMap);
                    // log.debug('subCustOwnerList', subCustOwnerList);
                    // log.debug('variableBillingFilter', variableBillingFilter);
                    // log.debug('ownerTechBillingFilter', ownerTechBillingFilter);
                    // log.debug('bbgrayBillingFilter', bbgrayBillingFilter);
                    // log.debug('subCustomerBillingFilter', subCustomerBillingFilter);

                    const dateFromVal = context.request.parameters.custpage_date_from ? formatDateForNS(context.request.parameters.custpage_date_from) : '';
                    const dateToVal = context.request.parameters.custpage_date_to ? formatDateForNS(context.request.parameters.custpage_date_to) : '';
                    const runSearch = context.request.parameters.search === "T";
                    const pageSize = 200;
                    var pageIndex = parseInt(context.request.parameters.page || 0);

                    if (context.request.parameters.custpage_date_from) {
                        billDateFromFld.defaultValue = context.request.parameters.custpage_date_from;
                    }

                    if (context.request.parameters.custpage_date_to) {
                        billDateToFld.defaultValue = context.request.parameters.custpage_date_to;
                    }

                    var pagedData;
                    let initialTotal = 0;
                    let variableAmount = 0;
                    let bbGrayOverLengthCase = false;

                    if (runSearch || billingAccVal || dateFromVal || dateToVal || pageSize || subscriptionFilterVal || itemFilterVal || subsidiaryFilterVal) {
                        const filterArray = [
                            // ["status", "anyof", "ACTIVE"],
                            // "AND",
                            ["charge.stage", "anyof", "READY_FOR_BILLING"]
                        ];

                        if (billingAccVal) {
                            filterArray.push("AND", ["billingaccount", "anyof", billingAccVal]);
                            billingAccFld.defaultValue = billingAccVal;
                        }

                        if (ownerTechBillingFilter == 'T') {
                          if (variableBillingFilter != 'T') {
                            filterArray.push("AND", ["customer.parent", "anyof", "@NONE@"]);
                            filterArray.push("AND", ["name", "contains", "tech"]);
                          }
                          ownerTechBillingFld.defaultValue = ownerTechBillingFilter;
                        }

                        if (bbgrayBillingFilter == 'T' && bbGrayOwnerIds.length) {
                          if (variableBillingFilter != 'T') {
                             filterArray.push("AND", ["customer.parent", "anyof", "@NONE@"]);
                          } 
                            
                          if (variableBillingFilter == 'T' && subCustomerBillingFilter == 'T') {
                            bbGrayOwnerIds.forEach(ownerIdIs => {
                              subCustOwnerList.push(ownerIdIs);
                            });
                          } else {

                            var ownerOrFilters = [];

                            if (bbGrayOwnerIds.length < 500) {
                            
                              bbGrayOwnerIds.forEach(function (val, index) {
                                 ownerOrFilters.push(
                                   ["customer.custentity_kdl_cust_owner_id", "contains", val]
                                 );

                                 if (index < bbGrayOwnerIds.length - 1) {
                                   ownerOrFilters.push("OR");
                                 }
                              });
                              
                            } else {
                              bbGrayOverLengthCase = true;
                            }

                            if (ownerOrFilters.length) {
                              filterArray.push("AND", ownerOrFilters);
                              filterArray.push("AND", ["name", "contains", "gray"]);
                            }
                            
                          }
                          
                          bbGrayBillingFld.defaultValue = bbgrayBillingFilter;
                        }

                        if (customerVal) {
                            if (variableBillingFilter == 'T') {
                              subCustOwnerList = [];
                            } 

                            filterArray.push("AND", ["customer", "anyof", customerVal]);
                            custFld.defaultValue = customerVal; 
                        }

                        if (subCustomerBillingFilter == 'T' && subCustOwnerList.length) {
                          if (variableBillingFilter != 'T') {
                             filterArray.push("AND", ["customer.parent", "noneof", "@NONE@"]);
                          }

                          let subCustOrFilters = [];

                          if (subCustOwnerList.length < 500) {
                            
                              subCustOwnerList.forEach(function (val, index) {
                                 subCustOrFilters.push(
                                   ["customer.entityid", "contains", val]
                                 );

                                 if (index < subCustOwnerList.length - 1) {
                                   subCustOrFilters.push("OR");
                                 }
                              });
                              
                          }

                          if (subCustOrFilters) {
                            filterArray.push("AND", subCustOrFilters);
                          }
                          
                          subCustomerBillingFld.defaultValue = subCustomerBillingFilter;
                        }

                        if (dateFromVal && dateToVal) {
                            filterArray.push("AND", ["charge.billdate", "within", dateFromVal, dateToVal]);
                        }
                        else if (dateFromVal) {
                            filterArray.push("AND", ["charge.billdate", "onorafter", dateFromVal]);
                        }
                        else if (dateToVal) {
                            filterArray.push("AND", ["charge.billdate", "onorbefore", dateToVal]);
                        }

                        if (subscriptionFilterVal) {
                            filterArray.push("AND", ["internalid", "anyof", subscriptionFilterVal]);
                            subscriptionFilter.defaultValue = subscriptionFilterVal;
                        }

                        if (subsidiaryFilterVal) {
                            filterArray.push("AND", ["subsidiary", "anyof", subsidiaryFilterVal]);
                            subsidiaryFld.defaultValue = subsidiaryFilterVal;
                        }

                        if (multiSelectItems.length) {
                            filterArray.push("AND", ["subscriptionline.item", "anyof", multiSelectItems]);
                            itemFilter.defaultValue = multiSelectItems;
                        } else {
                            if (subCustomerBillingFilter == 'T') {
                              filterArray.push("AND", ["subscriptionline.item", "anyof", SUBCUSTOMER_ITEMS]);
                              itemFilter.defaultValue = multiSelectItems;
                            }
                            
                            if (ownerTechBillingFilter == 'T') {
                              filterArray.push("AND", ["subscriptionline.item", "anyof", OWNER_TECH_ITEMS]);
                              itemFilter.defaultValue = multiSelectItems;
                            }
                        }

                        const itemTextCol = search.createColumn({
                            name: "formulatext",
                            formula: "{subscriptionline.item}",
                            label: "itemText"
                        });

                        const entityTextCol = search.createColumn({
                            name: "formulatext",
                            formula: "{customer}",
                            label: "entityText"
                        });

                        log.debug('filterArray', filterArray);

                        const subscriptionSearch = search.create({
                            type: "subscription",
                            filters: filterArray,
                            columns: [
                                search.createColumn({ name: "customer" }),
                                search.createColumn({ name: "name", label: "Name" }),
                                search.createColumn({ name: "billingaccount" }),
                                search.createColumn({ name: "subsidiary", label: "Subsidiary" }),
                                search.createColumn({ name: "item", join: "subscriptionLine" }),
                                search.createColumn({ name: "id", join: "charge" }),
                                search.createColumn({ name: "amount", join: "charge" }),
                                search.createColumn({ name: "billdate", join: "charge", sort: search.Sort.ASC }),
                                search.createColumn({ name: "stage", join: "charge" }),
                                search.createColumn({ name: "custrecord1393", join: "charge" }),
                                search.createColumn({ name: "custrecord1394", join: "charge" }),
                                search.createColumn({ name: "custrecord_hfc_customer_sales", join: "charge" }),
                                search.createColumn({ name: "custrecord_career_plan_fee", join: "charge" }),
                                search.createColumn({ name: 'department', join: 'billingAccount', label: 'Department' }),
                                search.createColumn({ name: 'currency', join: 'billingAccount', label: 'Currency' }),
                                search.createColumn({ name: "parent", join: "customer", label: "Top Level Parent" }),
                                search.createColumn({ name: "custentity_kdl_cust_owner_id", join: "customer", label: "Owner Id" }),
                                search.createColumn({ name: "entityid", join: "customer", label: "Customer Code" }),
                                itemTextCol,
                                entityTextCol
                            ]
                        });

                        try {
                          pagedData = subscriptionSearch.runPaged({
                            pageSize: pageSize
                          }); 
                        } catch (error) {
                          context.response.writePage(form);
                        }

                        // Requested page
                        let pageIndex = parseInt(context.request.parameters.page || '0', 10);

                        const pageRanges = pagedData.pageRanges;
                        const totalPages = pageRanges.length;
                        const totalRecords = pagedData.count;
                        const currentPage = pageIndex + 1;

                        // const infoHtml = `
                        //     <div style="width:100%; text-align:center; font-size:13px; margin-bottom:8px; margin-top:30px;">
                        //         <span style="text-align: left;">
                        //             <strong>Page:</strong> ${currentPage} / ${totalPages}
                        //         </span>
                        //         <span>
                        //             &nbsp;<strong>Total Records:</strong> ${totalRecords}
                        //         </span>
                        //     </div>
                        // `;

                        const infoHtml = `
                            <div style="width:100%; text-align:left; font-size:13px; margin-bottom:8px; margin-top:30px;">
                                <span style="text-align: left;">
                                    <strong>Page:</strong> 
                                    <input type="number" id="pageInput" value="${currentPage}" min="1" max="${totalPages}" style="width:50px;" />
                                    / ${totalPages}
                                    <button type="button" onclick="jumpToPage()">Go</button>
                                </span>
                                <span>
                                    &nbsp;<strong>Total Records:</strong> ${totalRecords}
                                </span>
                            </div>
                
                            <script>
                                function jumpToPage() {
                                    var page = parseInt(document.getElementById('pageInput').value, 10);
                                    if (page >= 1 && page <= ${totalPages}) {
                                        var url = new URL(window.location.href);
                                        url.searchParams.set('page', page - 1);
                                        
                                        let overlay = document.getElementById('loadingOverlay');
                                        if (overlay) overlay.style.display = 'block';
                                        
                                        window.location.href = url.toString();
                                        
                                        //window.location.href = window.location.pathname + '?page=' + (page - 1);
                                    } else {
                                        alert('Please enter a valid page number between 1 and ${totalPages}');
                                    }
                                }
                            </script>
                        `;

                        // form.addField({
                        //     id: 'custpage_info_header',
                        //     label: 'Info',
                        //     type: serverWidget.FieldType.INLINEHTML
                        // }).defaultValue = infoHtml;

                        pageCountField.defaultValue = infoHtml;

                        if (isNaN(pageIndex) || pageIndex < 0) {
                            pageIndex = 0;
                        }

                        // Prevent invalid fetch
                        if (pageIndex >= totalPages) {
                            pageIndex = 0;
                        }

                        if (!pageRanges || pageRanges.length === 0 || totalPages === 0) {
                            // form.addField({
                            //   id: 'custpage_no_data',
                            //   type: serverWidget.FieldType.INLINEHTML,
                            //   label: 'No Data'
                            // }).defaultValue = '<p style="color:red;font-weight:bold;">No data found.</p>';

                            context.response.writePage(form);

                            return;
                        }

                        const pageObj = pagedData.fetch(pageRanges[pageIndex].index);
                        let i = 0;

                        const resultRows = [];

                        /* =========================
                         * COLLECT + CALCULATE
                         * ========================= */
                        pageObj.data.forEach(result => {

                            const itemText = result.getValue(itemTextCol);
                            const entityText = result.getValue(entityTextCol);
                            const customerId = result.getValue("customer");
                            const customerEntityId = result.getValue({ name: "entityid", join: "customer" });
                            const billAccId = result.getValue("billingaccount");
                            const subscritpionId = result.id;
                            const itemID = result.getValue({ name: "item", join: "subscriptionLine" });
                            const ownerId = result.getValue({ name: "custentity_kdl_cust_owner_id", join: "customer" });
                            const chargeId = result.getValue({ name: "id", join: "charge" });
                            const subsidiaryId = result.getValue({ name: "subsidiary" });
                            const countOfTerritory = territoryMap[ownerId] || null;

                            if (bbgrayBillingFilter === 'T' && bbGrayOverLengthCase) {
                                const ownerLookup = Object.create(null);
                                bbGrayOwnerIds.forEach(id => ownerLookup[String(id)] = true);
                                if (!ownerLookup[ownerId]) return true;
                            }

                            let amount = 0;
                            if (itemText === 'Career Plug' || itemText === 'CAREERPLUG') {
                                amount = parseFloat(result.getValue({ name: "custrecord_career_plan_fee", join: "charge" })) || 0;
                            } else {
                                amount = parseFloat(result.getValue({ name: "amount", join: "charge" })) || 0;
                            }

                            let calculatedAmount = 0;

                            if (ownerTechBillingFilter === 'T' && countOfTerritory) {
                                calculatedAmount = getTechAmount(countOfTerritory);
                            }

                            if (bbgrayBillingFilter === 'T') {
                                calculatedAmount = getPercentValue(bbGrayMap[ownerId], BBGRAY_STACK);
                            }

                            if (subCustomerBillingFilter === 'T') {
                                const subCustMonthlyFees = subCustomersMap[customerEntityId] || 0;

                                if (itemText?.toLowerCase().includes("roy")) {
                                    calculatedAmount = Math.max(
                                        getPercentValue(subCustMonthlyFees, ROY_STACK),
                                        amount
                                    );
                                } else if (itemText?.toLowerCase().includes("naf")) {
                                    calculatedAmount = getPercentValue(subCustMonthlyFees, NAF_STACK);
                                } else if (itemText?.toLowerCase().includes("tech")) {
                                    calculatedAmount = subCustMonthlyFees;
                                }
                            }

                            resultRows.push({
                                result,
                                billDate: new Date(result.getValue({ name: "billdate", join: "charge" })),
                                amount,
                                calculatedAmount,
                                finalAmount: calculatedAmount || amount,
                                itemText,
                                entityText,
                                customerId,
                                customerEntityId,
                                billAccId,
                                subscritpionId,
                                itemID,
                                ownerId,
                                chargeId,
                                subsidiaryId,
                                countOfTerritory
                            });

                            return true;
                        });

                        /* =========================================
                         * SORT: Bill Date ASC → Amount DESC
                         * ========================================= */
                        resultRows.sort((a, b) => {
                            if (a.billDate.getTime() !== b.billDate.getTime()) {
                                return a.billDate - b.billDate;
                            }
                            return b.finalAmount - a.finalAmount;
                        });

                        /* =========================
                         * RENDER SUBLIST
                         * ========================= */
                        resultRows.forEach(row => {
                            const r = row.result;

                            sublist.setSublistValue({
                                id: 'custpage_customer_col',
                                line: i,
                                value: `<a href="/app/common/entity/custjob.nl?id=${row.customerId}" target="_blank">${r.getText("customer")}</a>`
                            });

                            sublist.setSublistValue({
                                id: 'custpage_customer_col_id',
                                line: i,
                                value: row.customerId
                            });

                            if (row.ownerId) {
                                sublist.setSublistValue({
                                    id: 'custpage_customer_owner_id',
                                    line: i,
                                    value: row.ownerId
                                });
                            }

                            sublist.setSublistValue({
                                id: 'custpage_subscription_col',
                                line: i,
                                value: `<a href="/app/accounting/subscription/subscription.nl?id=${row.subscritpionId}" target="_blank">${r.getValue("name")}</a>`
                            });

                            sublist.setSublistValue({
                                id: 'custpage_billingacc_col',
                                line: i,
                                value: `<a href="/app/accounting/otherlists/billingaccount.nl?id=${row.billAccId}" target="_blank">${r.getText("billingaccount")}</a>`
                            });

                            sublist.setSublistValue({
                                id: 'custpage_billingacc_col_id',
                                line: i,
                                value: row.billAccId
                            });

                            sublist.setSublistValue({
                                id: 'custpage_item',
                                line: i,
                                value: `<a href="/app/common/item/item.nl?id=${row.itemID}" target="_blank">${r.getText({ name: "item", join: "subscriptionLine" })}</a>`
                            });

                            sublist.setSublistValue({
                                id: 'custpage_item_id',
                                line: i,
                                value: row.itemID
                            });

                            sublist.setSublistValue({
                                id: 'custpage_charge_id_display',
                                line: i,
                                value: `<a href="/app/accounting/transactions/billing/charge.nl?id=${row.chargeId}" target="_blank">${row.chargeId}</a>`
                            });

                            sublist.setSublistValue({
                                id: 'custpage_chargeid',
                                line: i,
                                value: row.chargeId
                            });

                            sublist.setSublistValue({
                                id: 'custpage_amount',
                                line: i,
                                value: row.amount.toFixed(2)
                            });

                            sublist.setSublistValue({
                                id: 'custpage_amount_calculated',
                                line: i,
                                value: row.calculatedAmount.toFixed(2)
                            });

                            sublist.setSublistValue({
                                id: 'custpage_billdate',
                                line: i,
                                value: r.getValue({ name: "billdate", join: "charge" }) || ""
                            });

                            sublist.setSublistValue({
                                id: 'custpage_stage',
                                line: i,
                                value: r.getValue({ name: "stage", join: "charge" }) || ""
                            });

                            sublist.setSublistValue({
                                id: 'custpage_subsidiary_text',
                                line: i,
                                value: `<a href="/app/common/otherlists/subsidiarytype.nl?id=${row.subsidiaryId}" target="_blank">${r.getText({ name: "subsidiary" })}</a>`
                            });

                            sublist.setSublistValue({
                                id: 'custpage_subsidiary',
                                line: i,
                                value: row.subsidiaryId
                            });

                            sublist.setSublistValue({
                                id: 'custpage_department',
                                line: i,
                                value: r.getValue({ name: "department", join: "billingAccount" }) || 1
                            });

                            sublist.setSublistValue({
                                id: 'custpage_currency',
                                line: i,
                                value: r.getValue({ name: "currency", join: "billingAccount" }) || ""
                            });

                            sublist.setSublistValue({
                                id: 'custpage_entity_text',
                                line: i,
                                value: row.entityText || ""
                            });

                            sublist.setSublistValue({
                                id: 'custpage_item_text',
                                line: i,
                                value: row.itemText || ""
                            });

                            sublist.setSublistValue({
                                id: 'custpage_charge_customer_sales',
                                line: i,
                                value: r.getValue({ name: "custrecord_hfc_customer_sales", join: "charge" }) || "0"
                            });

                            i++;
                        });

                        // pageObj.data.forEach(result => {

                        //     const itemText = result.getValue(itemTextCol);
                        //     const entityText = result.getValue(entityTextCol);
                        //     const customerId = result.getValue("customer");
                        //     const customerEntityId = result.getValue({ name: "entityid", join: "customer" });
                        //     const billAccId = result.getValue("billingaccount");
                        //     const subscritpionId = result.id;
                        //     const itemID = result.getValue({ name: "item", join: "subscriptionLine" });
                        //     const isParentCustomerExist = result.getValue({ name: "parent", join: "customer" });
                        //     const ownerId = result.getValue({ name: "custentity_kdl_cust_owner_id", join: "customer" });
                        //     const chargeId = result.getValue({ name: "id", join: "charge" });
                        //     const subsidiaryId = result.getValue({ name: "subsidiary" });
                        //     const countOfTerritory = territoryMap[ownerId] || null;

                        //     if (bbgrayBillingFilter == 'T' && bbGrayOverLengthCase) {
                        //       //Special case in which BBGRAY have 500+ owners
                              
                        //       let ownerLookup = Object.create(null);
                        //       bbGrayOwnerIds.forEach(function (id) {
                        //          ownerLookup[String(id)] = true;
                        //       });

                        //       if (!ownerLookup[ownerId]) {
                        //         return true;
                        //       }
                        //     }

                        //     let amount;

                        //     if (itemText == 'Career Plug' || itemText == 'CAREERPLUG') {
                        //         amount = parseFloat(result.getValue({ name: "custrecord_career_plan_fee", join: "charge" })) || 0;
                        //     } else {
                        //         amount = parseFloat(result.getValue({ name: "amount", join: "charge" })) || 0;
                        //     }

                        //     initialTotal += amount;

                        //     sublist.setSublistValue({
                        //         id: 'custpage_customer_col',
                        //         line: i,
                        //         // value: result.getText("customer") || ""
                        //         value: '<a href="/app/common/entity/custjob.nl?id=' + customerId + '" target="_blank">' + result.getText("customer") + '</a>'
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_customer_col_id',
                        //         line: i,
                        //         value: result.getValue("customer") || ""
                        //     });

                        //     if (ownerId) {
                        //       sublist.setSublistValue({
                        //          id: 'custpage_customer_owner_id',
                        //          line: i,
                        //          value: ownerId || ""
                        //       }); 
                        //     }

                        //     sublist.setSublistValue({
                        //         id: 'custpage_subscription_col',
                        //         line: i,
                        //         value: '<a href="/app/accounting/subscription/subscription.nl?id=' + subscritpionId + '" target="_blank">' + result.getValue("name") + '</a>'
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_billingacc_col',
                        //         line: i,
                        //         value: '<a href="/app/accounting/otherlists/billingaccount.nl?id=' + billAccId + '" target="_blank">' + result.getText("billingaccount") + '</a>'
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_billingacc_col_id',
                        //         line: i,
                        //         value: result.getValue("billingaccount") || ""
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_item',
                        //         line: i,
                        //         // value: result.getText({ name: "item", join: "subscriptionLine" }) || ""
                        //         value: '<a href="/app/common/item/item.nl?id=' + itemID + '" target="_blank">' + result.getText({ name: "item", join: "subscriptionLine" }) + '</a>'
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_item_id',
                        //         line: i,
                        //         value: result.getValue({ name: "item", join: "subscriptionLine" }) || ""
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_charge_id_display',
                        //         line: i,
                        //         // value: result.getValue({ name: "id", join: "charge" }) || ""
                        //         value: '<a href="/app/accounting/transactions/billing/charge.nl?id=' + chargeId + '" target="_blank">' + result.getValue({ name: "id", join: "charge" }) + '</a>'
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_chargeid',
                        //         line: i,
                        //         value: result.getValue({ name: "id", join: "charge" }) || ""
                        //     });

                        //     if (itemText == 'Career Plug' || itemText == 'CAREERPLUG') {
                        //         sublist.setSublistValue({
                        //             id: 'custpage_amount',
                        //             line: i,
                        //             value: result.getValue({ name: "custrecord_career_plan_fee", join: "charge" }) || "0"
                        //         });
                        //     } 
                        //     else if (ownerTechBillingFilter == 'T' && countOfTerritory) {
                        //       const techAmount = countOfTerritory ? getTechAmount(countOfTerritory) : 0;
                              
                        //       sublist.setSublistValue({
                        //          id: 'custpage_amount_calculated',
                        //          line: i,
                        //          value: techAmount
                        //       });

                        //       variableAmount += techAmount;
                              
                        //       sublist.setSublistValue({
                        //          id: 'custpage_cust_territory',
                        //          line: i,
                        //          value: countOfTerritory
                        //       });
                        //     } 
                        //     else {
                        //         sublist.setSublistValue({
                        //             id: 'custpage_amount',
                        //             line: i,
                        //             value: result.getValue({ name: "amount", join: "charge" }) || "0"
                        //         });
                        //     }

                        //     if (bbgrayBillingFilter == 'T') {
                        //       const bbGrayMonthlyFees = bbGrayMap[ownerId];

                        //       const calculatedBBGrayFees = getPercentValue(bbGrayMonthlyFees, BBGRAY_STACK);

                        //       variableAmount += calculatedBBGrayFees;

                        //       sublist.setSublistValue({
                        //          id: 'custpage_amount_calculated',
                        //          line: i,
                        //          value: calculatedBBGrayFees || "0"
                        //       });

                        //     }

                        //     if (subCustomerBillingFilter == 'T') {
                        //       const subCustMonthlyFees = subCustomersMap[customerEntityId];
                        //       let calculatedSubCustomerFees = 0;

                        //       if (itemText && itemText.toLowerCase().includes("roy")) {
                        //         // isRoy = true;
                        //         calculatedSubCustomerFees = getPercentValue(subCustMonthlyFees, ROY_STACK);

                        //         if (amount > calculatedSubCustomerFees) {
                        //            calculatedSubCustomerFees = amount;
                        //         }
                        //       }

                        //       if (itemText && itemText.toLowerCase().includes("naf")) {
                        //         calculatedSubCustomerFees = getPercentValue(subCustMonthlyFees, NAF_STACK);
                        //       }

                        //       if (itemText && itemText.toLowerCase().includes("tech")) {
                        //         calculatedSubCustomerFees = subCustMonthlyFees;
                        //       }

                        //       variableAmount += calculatedSubCustomerFees;

                        //       sublist.setSublistValue({
                        //          id: 'custpage_amount_calculated',
                        //          line: i,
                        //          value: calculatedSubCustomerFees || "0"
                        //       });

                        //     }

                        //     sublist.setSublistValue({
                        //         id: 'custpage_billdate',
                        //         line: i,
                        //         value: result.getValue({ name: "billdate", join: "charge" }) || ""
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_stage',
                        //         line: i,
                        //         value: result.getValue({ name: "stage", join: "charge" }) || ""
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_subsidiary_text',
                        //         line: i,
                        //         value: '<a href="/app/common/otherlists/subsidiarytype.nl?id=' + subsidiaryId + '" target="_blank">' + result.getText({ name: "subsidiary" }) + '</a>'
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_subsidiary',
                        //         line: i,
                        //         value: result.getValue({ name: "subsidiary" }) || ""
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_department',
                        //         line: i,
                        //         value: result.getValue({ name: "department", join: "billingAccount" }) || 1
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_currency',
                        //         line: i,
                        //         value: result.getValue({ name: "currency", join: "billingAccount" }) || ""
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_entity_text',
                        //         line: i,
                        //         value: entityText || ""
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_item_text',
                        //         line: i,
                        //         value: itemText || ""
                        //     });

                        //     sublist.setSublistValue({
                        //         id: 'custpage_charge_customer_sales',
                        //         line: i,
                        //         value: result.getValue({ name: "custrecord_hfc_customer_sales", join: "charge" }) || "0"
                        //     });

                        //     resultRows.push({
                        //        result,
                        //        billDate: new Date(result.getValue({ name: "billdate", join: "charge" })),
                        //        amount,
                        //        calculatedAmount,
                        //        finalAmount: calculatedAmount || amount
                        //     });

                        //     i++;
                        //     return true;
                        // });
                    }

                    log.debug('isVariableCalc', isVariableCalc.defaultValue);

                    if (isVariableCalc.defaultValue == 'T') {
                      totalAmountFld.defaultValue = variableAmount.toFixed(2);
                    } else {
                      totalAmountFld.defaultValue = initialTotal.toFixed(2);
                    }


                    form.addSubmitButton("Submit Selected");

                    if (pagedData && pagedData.pageRanges.length > 1) {

                        if (pageIndex > 0) {
                            form.addButton({
                                id: 'custpage_prev',
                                label: 'Previous Page',
                                functionName: `goToPage(${pageIndex - 1})`
                            });
                        }

                        if (pageIndex < pagedData.pageRanges.length - 1) {
                            form.addButton({
                                id: 'custpage_next',
                                label: 'Next Page',
                                functionName: `goToPage(${pageIndex + 1})`
                            });
                        }

                        form.clientScriptModulePath = "SuiteScripts/billable_invoice_client_v2.js";
                    }

                    context.response.writePage(form);
                }

                else {
                    /** POST → On submit, collect selected rows */
                    const req = context.request;
                    const lineCount = req.getLineCount('custpage_results');
                    let selectedDataForInvoice = [];
                    const invoiceDate = req.parameters.custpage_invoice_date;
                    const isVariableBilling = req.parameters.custpage_variable_calc;

                    log.debug('isVariableBilling', isVariableBilling);
                  
                    for (let i = 0; i < lineCount; i++) {
                        const checked = req.getSublistValue({
                            group: 'custpage_results',
                            name: 'custpage_select',
                            line: i
                        });
                        if (checked === "T") {
                            let payload = {};
                            const chargeId = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custpage_chargeid',
                                line: i
                            });

                            if (chargeId) payload['charge'] = chargeId;

                            const billingAccount = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custpage_billingacc_col_id',
                                line: i
                            });

                            if (billingAccount) payload['billing_account'] = billingAccount;

                            const subsidiary = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custpage_subsidiary',
                                line: i
                            });

                            if (subsidiary) payload['subsidiary'] = subsidiary;

                            const customer = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custpage_customer_col_id',
                                line: i
                            });

                            if (customer) payload['customer'] = customer;

                            const department = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custpage_department',
                                line: i
                            });

                            if (department) payload['department'] = department;

                            const item = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custpage_item_id',
                                line: i
                            });

                            if (item) payload['item'] = item;

                            const amount = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custpage_amount',
                                line: i
                            });

                            const varCalcAmount = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custpage_amount_calculated',
                                line: i
                            });

                            if (isVariableBilling == 'T') {
                              if (varCalcAmount) payload['amount'] = varCalcAmount
                            } else {
                              if (amount) payload['amount'] = amount;
                            }


                            const currency = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custpage_currency',
                                line: i
                            });

                            if (currency) payload['currency'] = currency;

                            const itemText = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custpage_item_text',
                                line: i
                            });

                            if (itemText) payload['itemText'] = itemText;

                            const entityText = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custpage_entity_text',
                                line: i
                            });

                            if (entityText) payload['entityText'] = entityText;

                            const customerSalesCharge = req.getSublistValue({
                                group: 'custpage_results',
                                name: 'custrecord_hfc_customer_sales',
                                line: i
                            });

                            if (customerSalesCharge) payload['customer_sales'] = customerSalesCharge;

                            payload['invoice_date'] = invoiceDate ? invoiceDate : '';

                            selectedDataForInvoice.push(payload);
                        }
                    }

                    log.audit("Selected Charge IDs", selectedDataForInvoice);

                    const availableDeploymentInstance = getFreeDeployment();

                    var scheduleMRScriptTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_hfc_v2_invoice_creation_mr',
                        deploymentId: availableDeploymentInstance,
                        params: {
                            'custscript_invoice_list_': selectedDataForInvoice
                        }
                    });

                    let scriptTaskId = scheduleMRScriptTask.submit();

                    log.debug('scriptTaskId', scriptTaskId);

                    var redirectParams = {
                        custpage_billingacc: context.request.parameters.custpage_billingacc || '',
                        custpage_date_from: context.request.parameters.custpage_date_from || '',
                        custpage_date_to: context.request.parameters.custpage_date_to || '',
                        search: 'T',
                        ready: 'F',
                        scriptTaskId: scriptTaskId
                    };

                    log.debug('redirectParams', redirectParams);

                    redirect.toSuitelet({
                        scriptId: 'customscript_hfc_v2_custom_invoice_billa',
                        deploymentId: 'customdeploy_hfc_v2_custom_invoice_billa',
                        parameters: redirectParams
                    });

                    // context.response.write("Selected Charge IDs: " + JSON.stringify(selectedDataForInvoice));
                }

            } catch (e) {
                log.error("Suitelet Error", e);
                context.response.write("Error: " + e.message);
            }
        }

        function formatDateForNS(dateStr) {
            if (!dateStr) return "";

            const dateObj = new Date(dateStr);

            let m = dateObj.getMonth() + 1;
            let d = dateObj.getDate();
            let y = dateObj.getFullYear();
            if (m < 10) m = '0' + m;
            if (d < 10) d = '0' + d;
            return m + '/' + d + '/' + y;
        }

        function getFreeDeployment() {

            const DEPLOYMENTS = ['customdeploy_hfc_v2_invoice_creation_mr', 'customdeploy_hfc_v2_inv_creation_mr_2', 'customdeploy_hfc_v2_inv_creation_mr_3'];

            // Search existing running deployments
            const runningSearch = search.create({
                type: "scheduledscriptinstance",
                filters: [
                    ["script.internalid", "anyof", MR_SCRIPT_INTERNAL_ID],
                    "AND",
                    ["status", "anyof", "PENDING", "PROCESSING"]
                ],
                columns: [
                    search.createColumn({
                        name: "scriptid",
                        join: "scriptDeployment"
                    })
                ]
            });

            let runningDeployments = [];

            runningSearch.run().each(function (result) {
                const depId = result.getValue({
                  name: "scriptid",
                  join: "scriptDeployment"
                });

                if (depId) {
                  runningDeployments.push(depId.toLowerCase());
                }
                
                // runningDeployments.push(result.getValue({
                //     name: "scriptid",
                //     join: "scriptDeployment"
                // }));
                return true;
            });

            log.debug('Running Deployments:', runningDeployments);

            // Find free deployment
            const freeDeployment = DEPLOYMENTS.find(dep => !runningDeployments.includes(dep));

            log.debug('Free Deployment:', freeDeployment || 'None Available');

            return freeDeployment || 'customdeploy_hfc_v2_inv_creation_mr_3';
        }

        function getScriptParams() {
            let script = runtime.getCurrentScript();

            return {
                custscript_owner_tech_folder: script.getParameter({ name: 'custscript_owner_tech_folder' }),
                custscript_variable_report_folder: script.getParameter({ name: 'custscript_variable_report_folder' }),
                custscript_bbgray_percent: script.getParameter({ name: 'custscript_bbgray_percent' }),
                custscript_roy_percent: script.getParameter({ name: 'custscript_roy_percent' }),
                custscript_naf_percent: script.getParameter({ name: 'custscript_naf_percent' }),
                custscript_terms: script.getParameter({ name: 'custscript_terms' }),
            };
        }

        function getAllowedItems(context) {

            const isSubCustFilter = context.request.parameters.custpage_subcustomer_billing;
            const isTechFilter = context.request.parameters.custpage_owner_tech_billing;

            let itemSearchFilters = [
                ["type", "anyof", "NonInvtPart", "InvtPart", "Service"],
                "AND",
                ["custitem_include_invoice_billable_item", "is", "T"],
            ];

            if (isSubCustFilter == 'T') {
              itemSearchFilters.push("AND");
              itemSearchFilters.push(["internalid","anyof", SUBCUSTOMER_ITEMS]);
            }

            if (isTechFilter == 'T') {
              itemSearchFilters.push("AND");
              itemSearchFilters.push(["internalid","anyof", OWNER_TECH_ITEMS]);
            }
          
            const itemSearchObj = search.create({
                type: "item",
                filters: itemSearchFilters,
                columns: [
                    search.createColumn({ name: "internalid" }),
                    search.createColumn({ name: "itemid", label: "Name" }),
                    search.createColumn({ name: "displayname", label: "Display Name" }),
                    search.createColumn({ name: "custitem_include_invoice_billable_item", label: "Billable Item" })
                ]
            });

            const allowedItems = [];

            itemSearchObj.run().each(result => {
                const id = result.getValue({ name: "internalid" });
                const name =
                    result.getValue({ name: "displayname" }) ||
                    result.getValue({ name: "itemid" }) ||
                    "UNNAMED";

                allowedItems.push({
                    id: id,
                    text: name.toUpperCase()
                });

                return true;
            });

            return allowedItems;
        }

        function getTechAmount(ownerTerritory) {
            var techAmount = null;

            var searchObj = search.create({
                type: "customrecord_hfc_techbbvariable",
                filters: [
                    ["custrecord_hfc_owneractiveterritories", "equalto", ownerTerritory]
                ],
                columns: [
                    "custrecord_hfc_techamount"
                ]
            });

            searchObj.run().each(function (result) {
                techAmount = parseFloat(result.getValue("custrecord_hfc_techamount")) || 0;
                return false;
            });

            return techAmount;
        }

        function readCsvMaster(fileId, isTechMap) {
            const fileObj = file.load({ id: fileId });
            const content = fileObj.getContents();

            // Split rows and remove empty lines
            // const rows = content.split(/\r?\n/).filter(r => r.trim() !== '');
            const rows = smartSplitRows(content).filter(r => r.trim() !== '');
            if (!rows.length) return [];

            /* --------------------------------------------------------
               Robust CSV splitter (handles quotes, commas, "" escapes)
            ---------------------------------------------------------*/
            function splitCsvLine(line) {
                const out = [];
                let cur = '';
                let inQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];

                    if (ch === '"') {
                        if (inQuotes && line[i + 1] === '"') {
                            cur += '"';
                            i++;
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (ch === ',' && !inQuotes) {
                        out.push(cur);
                        cur = '';
                    } else {
                        cur += ch;
                    }
                }

                out.push(cur);

                // Clean leftover quotes + trim
                return out.map(s => {
                    let v = s.trim();
                    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
                        v = v.slice(1, -1);
                    }
                    return v;
                });
            }

            /* --------------------------------------------------------
               Normalize header (remove symbols, lower-case, clean spaces)
            ---------------------------------------------------------*/
            function normalizeHeader(h) {
                return h
                    .trim()
                    .toLowerCase()
                    .replace(/[^\w\s]/g, '') // remove punctuation
                    .replace(/\s+/g, '_');   // collapse spaces
            }

            // Parse header row
            const rawHeaders = splitCsvLine(rows.shift());
            const headerMap = {};

            rawHeaders.forEach((h, i) => {
                headerMap[normalizeHeader(h)] = {
                    raw: h,
                    index: i
                };
            });

            log.debug('headerMap', headerMap);

            if (isTechMap) {
              const parsedTechRows = rows.map((line, idx) => {
                    const cols = splitCsvLine(line);
                    const rowObj = {};

                    Object.keys(headerMap).forEach(normKey => {
                        const colIdx = headerMap[normKey].index;
                        let val = cols[colIdx] || '';

                        if (normKey.includes('territor')) {
                            val = Number(val || 0);
                            rowObj['territories'] = val;
                        } else {
                            rowObj[normKey] = val;
                        }
                    });

                    return rowObj;
                });

                return parsedTechRows;
            }

            const parsedRows = rows.map((line, idx) => {
                const cols = splitCsvLine(line);
                const rowObj = {};

                Object.keys(headerMap).forEach(normKey => {
                    const colIdx = headerMap[normKey].index;
                    rowObj[normKey] = cols[colIdx] || '';
                });

                return rowObj;
            });

            return parsedRows;
        }

        function getTerritoryCount(data, ownerNumber) {
            const record = data.find(r => r.ownernumber === ownerNumber);

            if (!record) return 0;

            const territoriesKey = Object.keys(record).find(k => k.includes('territories'));

            return Number(record[territoriesKey]) || 0;
        }

        function smartSplitRows(content) {
            const lines = content.split(/\r?\n/);
            const rows = [];
            let buffer = '';
            let insideQuotes = false;

            for (let line of lines) {
                // Count quotes in this line
                const quotes = (line.match(/"/g) || []).length;

                if (!insideQuotes) {
                    buffer = line;
                } else {
                    buffer += '\n' + line; // preserve newline inside quotes
                }

                insideQuotes = insideQuotes
                    ? !(quotes % 2 === 1) // toggle when odd number of quotes found
                    : quotes % 2 === 1;

                if (!insideQuotes) {
                    rows.push(buffer);
                    buffer = '';
                }
            }

            if (buffer.trim() !== '') rows.push(buffer);

            return rows;
        }

        function filterBBReport(dataList) {
            let resultMap = {};
            let ownerIdList = [];
            let subCustomers = {};
            let subCustomersOwnerIds = [];

            dataList.forEach(row => {

                const ownerId = (row.acctterrnum || '').toString().trim();

                let monthly = row.monthly_report || '0';
                monthly = Number(monthly.replace(/,/g, '')) || 0;
                
                if (ownerId.toLowerCase().includes('gray')) {
                    resultMap[row.owner_] = monthly;
                    ownerIdList.push(row.owner_);
                } else {
                    subCustomers[row.acctterrnum] = monthly;

                    if (row.owner_ != 'GRAND TOTAL' && row.owner_ != '') {
                       subCustomersOwnerIds.push(row.owner_);
                    }
                }
            });

            return {
              resultMap,
              ownerIdList,
              subCustomers,
              subCustomersOwnerIds
            };
        }

        function getCustomerOwnerId(customerId) {
            if (!customerId) return null;

            return search.lookupFields({
                type: search.Type.CUSTOMER,
                id: customerId,
                columns: ['custentity_kdl_cust_owner_id']
            }).custentity_kdl_cust_owner_id || null;
        }

        function getPercentValue(value, percent) {
           value = parseFloat(value) || 0;
           percent = Number(percent) || 0;
          
           return value * (percent / 100);
        }

        function parsePercent(val, defaultVal) {
          if (!val) return defaultVal;
          return parseFloat(val.toString().replace('%', '').trim());
        }

        function getCurrentMonthDateRange() {
            const today = new Date();
        
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
            return {
                from: format.format({
                    value: monthStart,
                    type: format.Type.DATE
                }),
                to: format.format({
                    value: monthEnd,
                    type: format.Type.DATE
                })
            };
        }

        function getLatestFileFromFolder(folderId) {
            try {
                const fileSearch = search.create({
                    type: 'file',
                    filters: [
                        ['folder', 'anyof', folderId]
                    ],
                    columns: [
                        search.createColumn({
                            name: 'created',
                            sort: search.Sort.DESC
                        }),
                        'internalid',
                        'name',
                        'url'
                    ]
                });

                let latestFile = null;

                fileSearch.run().each(function (result) {
                    latestFile = {
                        id: result.getValue('internalid'),
                        name: result.getValue('name'),
                        url: result.getValue('url'),
                        created: result.getValue('created')
                    };
                    return false;
                });

                return latestFile.id;
            } catch (error) {
                log.debug('error', error);
                return null;
            }
        }

        return { onRequest };
    });

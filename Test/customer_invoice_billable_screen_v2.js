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
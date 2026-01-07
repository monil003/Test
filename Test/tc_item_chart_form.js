/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @version v1.0.3
 */
define(['N/ui/serverWidget', 'N/search'], function (serverWidget, search) {


    function beforeLoad(context) { //test
        try {
            if (context.type !== context.UserEventType.VIEW) return; //test1 test 2


            var form = context.form;
            const itemId = context.newRecord.id;
            const locationId = null;


            var htmlField = form.addField({
                id: 'custpage_chart_html',
                label: ' ',
                type: serverWidget.FieldType.INLINEHTML,
                container: 'custom777'
            });


            const inventoryData = getAssemblyItemInventory(itemId);
            // const soUsageData = getSOUsage(itemId, locationId);
            const soUsageData = getSOUsage1(itemId, locationId);


            log.debug('inventoryData', inventoryData);
            log.debug('soUsageData', soUsageData);


            htmlField.defaultValue = generateAssemblyHtml(inventoryData, soUsageData);


        } catch (error) {
            log.debug('error', error);
        }
    }


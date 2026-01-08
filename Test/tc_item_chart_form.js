/**
 * @version v1.0.3
 */

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget', 'N/search'], function (serverWidget, search) {


    function beforeLoad(context) { //test333
        try {
            if (context.type !== context.UserEventType.VIEW) return;


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


    function generateAssemblyHtml(inventoryData, soUsageData) {




        const locations = Object.keys(inventoryData);
        let inventoryArray = [];


        //Convert object to array
        const inventoryArrayIs = locations.forEach(function (locId) {


            const row = inventoryData[locId];


            inventoryArray.push({
                locationId: row.locationId,
                location: row.locationName,
                onHand: row.onHand,
                committed: row.committed,
                available: row.available,
                backOrdered: row.backordered
            });
        });


        const defaultLocation = locations[0] || '';


        const locationMap = buildLocationMap(locations);


        const locationOptionsHtml = Object.keys(locationMap)
            .map(function (id) {
               return '<option value="' + id + '">' + locationMap[id] + '</option>';
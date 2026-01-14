/**
 * @version v1.0.1
 */

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/https', 'N/log', 'N/record', 'N/search', 'N/runtime'], (https, log, record, search, runtime) => {


    const KEEP_IT_COOL_BASE_URL = 'https://api.keepit.cool/v1/shipments/';
    const KEEP_IT_COOL_AUTH = 'Api-Key JfSYGoYN.79w4RQfYng0vPJUJ8GlWnl58RT5ISxMS';
    const DRY_ICE_ITEM_ID = 13528;
    const DISTRIBUTION_CENTER_ID = '372e08c3-86fe-4357-8ae3-c70a64b281b2';
    const NEXT_DAY_SHIPPING_METHOD = '2d173359-3e6f-49be-afaf-d15a17e47d4c';
    const UPS_SHIPPING_METHOD = '2839e6bc-c2d1-4f75-956d-f03f3ef44ab4';
    const UPS_NEXT_DAY_SHIPPING_METHOD = 'a65ce665-f7d2-47fd-bf0a-fd603d5d87cd';
    const OKC_FC_LOCATION = 4;
    const PA_LOCATION = 2;
    const PACCURATE_API_URL = 'https://api.paccurate.io';
    const PACCURATE_API_KEY = 'apikey 14KYiBm6lxWXVf1NNxrziggwPHcttkQ352bMI6-HMOzVvLPGSSfBlVcQxycR96Yu';
    const PETCO_CUSTOMER_ID = 322186;


    const afterSubmit = (context) => {
        try {
            if (context.type === context.UserEventType.DELETE) return;


            const soId = context.newRecord.id;


            const soRec = record.load({ type: record.Type.SALES_ORDER, id: soId, isDynamic: true });


            const customerId = soRec.getValue({ fieldId: 'entity' });


            if (customerId == PETCO_CUSTOMER_ID) {
                log.debug('Skipping script', 'Petco customer detected');
                return;
            }


            var DryIceQtyFromKIC = 0;
            // If OKC location and no package_type, call KeepItCool to populate package type and potentially add dry ice
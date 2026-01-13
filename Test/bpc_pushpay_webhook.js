/**
 * @version v1.0.1
 */

/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/record'], (log, record) => {


    const onRequest = (context) => {
        log.debug('here inn', context);


        if (context.request.method !== 'GET') {
          log.debug('in get request', context);
        }
      
        if (context.request.method !== 'POST') {
            context.response.write('Method Not Allowed');
            return;
        }


        // Validate shared secret
        const secret = context.request.headers['x-pushpay-secret'];
        if (secret !== 'MY_SHARED_SECRET') {
            context.response.write('Unauthorized');
            return;
        }


        const body = JSON.parse(context.request.body);
        log.audit('Pushpay Webhook', body);


        // Minimal processing here
        // Queue Map/Reduce or save to custom record


        context.response.write('OK');
    };


    return { onRequest };
});


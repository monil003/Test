/**
 * @version v1.0.1
 */

/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log'], (log) => {

    const onRequest = (context) => {
        try {
            if (context.request.method !== 'POST') {
                context.response.write('OK');
                return;
            }

            const headers = context.request.headers;
            log.debug('Headers', headers);

            const secret = headers['x-pushpay-secret'];

            if (secret !== 'MY_SHARED_SECRET') {
                log.error('Unauthorized webhook attempt', headers);
                context.response.write('OK');
                return;
            }

            const body = JSON.parse(context.request.body || '{}');
            log.audit('Pushpay Webhook Payload', body);

            // Save payload / queue MR here

        } catch (e) {
            log.error('Webhook Error', e);
        }

        context.response.write('OK');
    };

    return { onRequest };
});

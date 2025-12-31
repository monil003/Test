/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/file', 'N/search'], function (file, search) {

    function onRequest(context) {
        try {
            var fileName = context.request.parameters.fileName;

            if (!fileName) {
                context.response.write(JSON.stringify({
                    success: false,
                    message: "fileName is required"
                }));
                return;
            }

            // Search file by name
            var fileSearch = search.create({
                type: 'file',
                filters: [
                    ['name', 'is', fileName]
                ],
                columns: ['internalid']
            });

            var result = fileSearch.run().getRange({ start: 0, end: 1 });

            if (!result || result.length === 0) {
                context.response.write(JSON.stringify({
                    success: false,
                    message: 'File not found'
                }));
                return;
            }

            var fileId = result[0].getValue('internalid');
            var fileObj = file.load({ id: fileId });

            log.debug('here', {fileId, fileObj});

            context.response.write(JSON.stringify({
                success: true,
                fileName: fileObj.name,
                fileType: fileObj.fileType,
                content: fileObj.getContents() // base64
            }));

        } catch (e) {
            context.response.write(JSON.stringify({
                success: false,
                error: e.message
            }));
        }
    }

    return { onRequest };
});

function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

loadScript(chrome.runtime.getURL('lib/pdf-lib.min.js'))
    .then(() => {
        console.log('pdf-lib.min.js loaded successfully');
        initApp();
    })
    .catch(error => {
        console.error('Failed to load pdf-lib.min.js', error);
    });

function initApp() {
    document.addEventListener('DOMContentLoaded', function() {
        const folderInput = document.getElementById('folderInput');
        const mergeButton = document.getElementById('mergeButton');
        const statusDiv = document.getElementById('status');

        mergeButton.addEventListener('click', async () => {
            const files = folderInput.files;
            const pdfFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.pdf'));

            if (pdfFiles.length === 0) {
                statusDiv.textContent = '未找到PDF文件';
                return;
            }

            statusDiv.textContent = '正在合并PDF文件...';

            try {
                const mergedPdf = await mergePDFs(pdfFiles);
                const blob = new Blob([mergedPdf], { type: 'application/pdf' });
                
                chrome.runtime.sendMessage({
                    action: "downloadPDF",
                    url: URL.createObjectURL(blob),
                    filename: 'merged.pdf'
                }, (response) => {
                    if (response.success) {
                        statusDiv.textContent = 'PDF文件已成功合并并开始下载';
                    } else {
                        console.error('下载失败:', response.error);
                        statusDiv.textContent = '下载失败,请重试';
                    }
                });
            } catch (error) {
                console.error('PDF合并失败:', error);
                statusDiv.textContent = 'PDF合并失败,请重试';
            }
        });
    });
}

async function mergePDFs(pdfFiles) {
    const pdfDoc = await PDFLib.PDFDocument.create();

    for (const pdfFile of pdfFiles) {
        const pdfBytes = await readFileAsArrayBuffer(pdfFile);
        const pdf = await PDFLib.PDFDocument.load(pdfBytes);
        const copiedPages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => pdfDoc.addPage(page));
    }

    return pdfDoc.save();
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

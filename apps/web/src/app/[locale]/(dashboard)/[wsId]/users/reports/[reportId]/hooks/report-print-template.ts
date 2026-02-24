interface BuildReportPrintContentOptions {
  printableAreaHtml: string;
  documentTitle: string;
  stylesheets: string;
}

export function buildReportPrintContent({
  printableAreaHtml,
  documentTitle,
  stylesheets,
}: BuildReportPrintContentOptions): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${documentTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${stylesheets}
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: system-ui, -apple-system, sans-serif;
            background: white;
            color: black;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            #printable-area {
              height: auto !important;
              width: auto !important;
              max-width: none !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              margin: 0 !important;
              background: white !important;
              color: black !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            .print\\:text-black {
              color: black !important;
            }
            .print\\:bg-white {
              background-color: white !important;
            }
            .print\\:border-black {
              border-color: black !important;
            }
            .print\\:text-red-600 {
              color: #dc2626 !important;
            }
            .print\\:border-0 {
              border: none !important;
            }
            .print\\:rounded-none {
              border-radius: 0 !important;
            }
            .print\\:h-auto {
              height: auto !important;
            }
            .print\\:p-8 {
              padding: 2rem !important;
            }
            .print\\:w-auto {
              width: auto !important;
            }
            .print\\:max-w-none {
              max-width: none !important;
            }
            .print\\:shadow-none {
              box-shadow: none !important;
            }
            .print\\:m-0 {
              margin: 0 !important;
            }
            .print\\:p-4 {
              padding: 1rem !important;
            }
            .print\\:opacity-50 {
              opacity: 0.5 !important;
            }
          }
        </style>
      </head>
      <body>
        ${printableAreaHtml}
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            }, 500);
          };
        </script>
      </body>
    </html>
  `;
}

import { useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const PdfPane = ({ bookUrl, pageNumber, numPages, setNumPages, setPageNumber, controlsVisible, setControlsVisible }) => {
  const viewportWidth = Math.min(window.innerWidth * 0.9, 1000);

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-y-auto scroll-smooth no-scrollbar pt-24 pb-12 flex flex-col items-center"
      onClick={() => setControlsVisible((v) => !v)}
    >
      <Document
        file={bookUrl}
        onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
        loading={<div className="text-white">Loading PDF...</div>}
      >
        <Page pageNumber={pageNumber} width={viewportWidth} />
      </Document>

      {numPages && controlsVisible && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-6 py-3 rounded-full text-white text-xs font-bold tracking-widest uppercase flex items-center gap-6 z-50">
          <button onClick={(e) => { e.stopPropagation(); setPageNumber((p) => Math.max(1, p - 1)); }} className="hover:text-primary transition-colors text-xl">&lt;</button>
          <span>{pageNumber} / {numPages}</span>
          <button onClick={(e) => { e.stopPropagation(); setPageNumber((p) => Math.min(numPages, p + 1)); }} className="hover:text-primary transition-colors text-xl">&gt;</button>
        </div>
      )}
    </div>
  );
};

export default PdfPane;

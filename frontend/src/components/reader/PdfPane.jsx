import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Highlighter } from 'lucide-react';

const escapeHtml = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const PdfPane = ({
  bookUrl,
  pageNumber,
  numPages,
  setNumPages,
  setPageNumber,
  controlsVisible,
  onProgress,
  highlights = [],
  onSelection,
  isManga = false,
}) => {
  const frameRef = useRef(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentPageInternal, setCurrentPageInternal] = useState(pageNumber || 1);
  const [totalPagesInternal, setTotalPagesInternal] = useState(numPages || 0);

  useEffect(() => {
    if (!numPages && totalPagesInternal) setNumPages(totalPagesInternal);
  }, [numPages, setNumPages, totalPagesInternal]);

  useEffect(() => {
    if (typeof onProgress === 'function' && totalPagesInternal > 0) {
      onProgress(currentPageInternal, totalPagesInternal);
    }
  }, [currentPageInternal, onProgress, totalPagesInternal]);

  useEffect(() => {
    setCurrentPageInternal(pageNumber || 1);
  }, [pageNumber]);

  const highlightsScript = JSON.stringify(
    (highlights || []).map((h) => ({
      text: h.text_excerpt || '',
      color: h.color || '#fde047',
      id: h.id,
    }))
  );

  const srcDoc = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      html, body { margin: 0; width: 100%; height: 100%; background: #080b13; color: #e6edf3; font-family: Inter, system-ui, sans-serif; overflow: hidden; }
      #stage { position: fixed; inset: 0; }
      #pdfFrame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #080b13; }
      mark.reader-highlight { padding: 0; border-radius: 2px; }
    </style>
  </head>
  <body>
    <div id="stage">
      <iframe id="pdfFrame" src="${escapeHtml(`${bookUrl}#toolbar=0&navpanes=0&scrollbar=1&page=${Math.max(1, pageNumber || 1)}`)}" title="PDF Reader"></iframe>
    </div>
    <script>
      (function() {
        const highlights = ${highlightsScript};
        const pdfBase = ${JSON.stringify(`${bookUrl}#toolbar=0&navpanes=0&scrollbar=1&page=`)};
        const pdfFrame = document.getElementById('pdfFrame');
        const pageParam = new URL(window.location.href).searchParams.get('page');
        let currentPage = Number(pageParam || ${Math.max(1, pageNumber || 1)}) || 1;
        let totalPages = Number(new URL(window.location.href).searchParams.get('pages') || ${Number(numPages) || 0}) || 0;
        const publishState = () => {
          parent.postMessage({ type: 'pdf-state', page: currentPage, pages: totalPages }, '*');
        };
        const applyPageToFrame = () => {
          if (!pdfFrame) return;
          pdfFrame.src = pdfBase + currentPage;
        };
        const parseFromHash = () => {
          try {
            const hash = decodeURIComponent(window.location.hash || '');
            const pageMatch = hash.match(/(?:^|[&#?])page=(\\d+)/i);
            if (pageMatch) currentPage = Math.max(1, Number(pageMatch[1]) || currentPage);
            const pagesMatch = hash.match(/(?:^|[&#?])pages=(\\d+)/i);
            if (pagesMatch) totalPages = Math.max(0, Number(pagesMatch[1]) || totalPages);
            applyPageToFrame();
            publishState();
          } catch (_) {}
        };
        document.addEventListener('selectionchange', () => {
          const selectedText = window.getSelection ? window.getSelection().toString().trim() : '';
          if (!selectedText) return;
          parent.postMessage({ type: 'pdf-selection', text: selectedText, locator: 'page:' + currentPage + '::' + selectedText.slice(0, 80) }, '*');
        });
        window.addEventListener('hashchange', parseFromHash);
        window.addEventListener('message', (event) => {
          const data = event.data || {};
          if (data.type === 'pdf-nav' && Number.isFinite(data.page)) {
            currentPage = Math.max(1, Number(data.page));
            const url = new URL(window.location.href);
            const baseHash = '#page=' + currentPage + (totalPages ? '&pages=' + totalPages : '');
            window.location.hash = baseHash;
            applyPageToFrame();
            publishState();
          }
        });
        parseFromHash();
        publishState();
      })();
    </script>
  </body>
</html>`;

  useEffect(() => {
    const onMessage = (event) => {
      const data = event.data || {};
      if (data.type === 'pdf-state') {
        const nextPage = Math.max(1, Number(data.page) || 1);
        const nextPages = Math.max(0, Number(data.pages) || totalPagesInternal || 0);
        setCurrentPageInternal(nextPage);
        setPageNumber(nextPage);
        if (nextPages) {
          setTotalPagesInternal(nextPages);
          setNumPages(nextPages);
        }
      } else if (data.type === 'pdf-selection' && !isManga && typeof onSelection === 'function') {
        const text = (data.text || '').trim();
        if (!text) return;
        onSelection({
          format: 'pdf',
          locator: data.locator || `page:${currentPageInternal}::${text.slice(0, 80)}`,
          text,
        });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [currentPageInternal, isManga, onSelection, setNumPages, setPageNumber, totalPagesInternal]);

  const navToPage = (nextPage) => {
    const target = Math.max(1, Math.min(totalPagesInternal || Number.MAX_SAFE_INTEGER, nextPage));
    setCurrentPageInternal(target);
    setPageNumber(target);
    frameRef.current?.contentWindow?.postMessage({ type: 'pdf-nav', page: target }, '*');
  };

  return (
    <div className="absolute inset-0 w-full h-full bg-[#080b13]">
      {!error ? (
        <iframe
          ref={frameRef}
          title="PDF Reader"
          className="w-full h-full border-none"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin allow-downloads allow-modals allow-popups"
          onLoad={() => setReady(true)}
          onError={() => setError(true)}
        />
      ) : (
        <div className="h-full grid place-items-center">
          <div className="text-center space-y-4">
            <p className="tech-label text-red-500">PDF_Render_Failure</p>
            <a href={bookUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary uppercase tracking-wider">Open in Browser</a>
          </div>
        </div>
      )}

      {controlsVisible && !error && ready && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10">
          <button onClick={() => navToPage(currentPageInternal - 1)} className="btn-icon w-8 h-8" disabled={currentPageInternal <= 1}>
            <ChevronLeft size={14} />
          </button>
          <div className="text-[11px] text-white/80 font-mono min-w-[90px] text-center">
            {currentPageInternal}{totalPagesInternal ? ` / ${totalPagesInternal}` : ''}
          </div>
          <button
            onClick={() => navToPage(currentPageInternal + 1)}
            className="btn-icon w-8 h-8"
            disabled={Boolean(totalPagesInternal) && currentPageInternal >= totalPagesInternal}
          >
            <ChevronRight size={14} />
          </button>
          {!isManga && <Highlighter size={14} className="text-primary/80" />}
        </div>
      )}
    </div>
  );
};

export default PdfPane;

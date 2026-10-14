interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export default function Pager({ page, pageSize, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" className="gd-link" onClick={() => onPage(page - 1)} disabled={page <= 1}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button type="button" className="gd-link" onClick={() => onPage(page + 1)} disabled={page >= pages}>Next</button>
    </nav>
  );
}

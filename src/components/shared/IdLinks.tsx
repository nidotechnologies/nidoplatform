import { useNavigate } from "react-router-dom";

const linkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "inherit",
  color: "#2563eb",
  fontWeight: 600,
  fontSize: "inherit",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const hoverStyle: React.CSSProperties = {
  textDecoration: "underline",
};

export function POLink({ id, style }: { id: string; style?: React.CSSProperties }) {
  const navigate = useNavigate();
  if (!id || id === "-") return <span style={style}>{id || "-"}</span>;
  return (
    <button
      style={{ ...linkStyle, ...style }}
      onMouseEnter={e => Object.assign((e.target as HTMLElement).style, hoverStyle)}
      onMouseLeave={e => ((e.target as HTMLElement).style.textDecoration = "none")}
      onClick={e => { e.stopPropagation(); navigate(`/vendor-orders/${id}`); }}
    >
      {id}
    </button>
  );
}

export function OrderLink({ id, style }: { id: string; style?: React.CSSProperties }) {
  const navigate = useNavigate();
  if (!id || id === "-") return <span style={style}>{id || "-"}</span>;
  return (
    <button
      style={{ ...linkStyle, ...style }}
      onMouseEnter={e => Object.assign((e.target as HTMLElement).style, hoverStyle)}
      onMouseLeave={e => ((e.target as HTMLElement).style.textDecoration = "none")}
      onClick={e => { e.stopPropagation(); navigate(`/orders/${id}`); }}
    >
      {id}
    </button>
  );
}

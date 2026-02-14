export function Toast(props: { text: string }) {
  if (!props.text) return null;
  return (
    <div style={{
      position:"fixed", left:"50%", bottom:18, transform:"translateX(-50%)",
      background:"#222", border:"1px solid #333", padding:"10px 12px", borderRadius:12,
      maxWidth: "90vw"
    }}>
      {props.text}
    </div>
  );
}

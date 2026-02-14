import { useEffect, useState } from "react";
import { Home } from "./ui/Home";
import { Module } from "./ui/Module";
import "./styles.css";

type Route = "/" | "/vocab" | "/grammar";

function normalizeRoute(hash: string): Route {
  const r = (hash || "").replace("#", "");
  if (r === "/vocab" || r === "/grammar" || r === "/") return r;
  return "/";
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => normalizeRoute(location.hash));

  function go(path: Route) {
    location.hash = path;
    setRoute(path);
  }

  useEffect(() => {
    const onHash = () => setRoute(normalizeRoute(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (route === "/vocab") return <Module type="vocab" go={go} />;
  if (route === "/grammar") return <Module type="grammar" go={go} />;
  return <Home go={go} />;
}

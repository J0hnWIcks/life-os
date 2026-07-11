import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Planner from "./pages/Planner";
import CalendarPage from "./pages/CalendarPage";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Documents from "./pages/Documents";
import Knowledge from "./pages/Knowledge";
import Tags from "./pages/Tags";
import Analytics from "./pages/Analytics";
import WeeklyReview from "./pages/WeeklyReview";
import Focus from "./pages/Focus";
import Support from "./pages/Support";
import Trash from "./pages/Trash";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="planner" element={<Planner />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="documents" element={<Documents />} />
          <Route path="knowledge" element={<Knowledge />} />
          <Route path="tags" element={<Tags />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="weekly-review" element={<WeeklyReview />} />
          <Route path="focus" element={<Focus />} />
          <Route path="support" element={<Support />} />
          <Route path="trash" element={<Trash />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

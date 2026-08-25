import React from "react";

import NotFoundPage from "./NotFoundPage";
import ExercisesPage from "../pages/exercises/ExercisesPage";
import ProgressPage from "../pages/progress/ProgressPage";
import ReportPage from "../pages/report/ReportPage";
import SettingsPage from "../pages/settings/SettingsPage";
import StatisticsPage from "../pages/statistics/StatisticsPage";
import TodayPage from "../pages/today/TodayPage";
import WorkoutPage from "../pages/workout/WorkoutPage";
import WeightTrendPage from "../pages/weight-trend/WeightTrendPage";

const routes = [
  { pathPrefix: "/exercises", Page: ExercisesPage },
  { pathPrefix: "/statistics", Page: StatisticsPage },
  { pathPrefix: "/settings", Page: SettingsPage },
  { pathPrefix: "/progress", Page: ProgressPage },
  { pathPrefix: "/report", Page: ReportPage },
  { pathPrefix: "/workout/", Page: WorkoutPage },
  { pathPrefix: "/weight-trend", Page: WeightTrendPage },
];

export default function App() {
  const currentPath = window.location.pathname;
  const matchedRoute = routes.find(({ pathPrefix }) =>
    currentPath.startsWith(pathPrefix),
  );
  const CurrentPage =
    currentPath === "/" ? TodayPage : matchedRoute?.Page ?? NotFoundPage;

  return <CurrentPage />;
}

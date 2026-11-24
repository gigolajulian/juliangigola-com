import * as React from "react";
import { fromIso, minutesOf, type PickedTime } from "@/components/booking/picker/parts";
import { monthCells, startOfToday, weekFrom } from "@/components/booking/picker/dates";

/* The day and the time picked, and the week or month on show
   (`use-picker.tsx`, which keeps the effects that set them). */
export function usePickerDays(days: Record<string, string[]> | null, startView?: "week" | "month") {
  // The card opens on its month, or on startView.
  const [view, setView] = React.useState<"week" | "month">(startView ?? "month");
  const [anchor, setAnchor] = React.useState(() => new Date()); // the week or month on show
  const [pick, setPick] = React.useState<PickedTime | null>(null);
  /* What has been picked by hand: nothing (the first open time is only
     on show), a day, or a day and its time. A day alone keeps Confirm off,
     so clicking one never skips step two. */
  const [chosen, setChosen] = React.useState<false | "day" | "time">(false);

  /* A time button picks the time; a day keeps the time already picked
     when that day has it open, and otherwise waits for one. */
  const choose = (date: string, min: number, time: boolean) => {
    const list = days?.[date];
    if (!list?.length) return;
    const s = list.find((x) => minutesOf(x) === min);
    setChosen(time || (s && chosen === "time") ? "time" : "day");
    const t = s ?? list[0];
    setPick({ date, min: minutesOf(t), start: t });
  };

  /* The week or month under the cards. A week is the seven days from the
     one on show, never from before today: a calendar week opened on a
     Saturday was six days already gone. */
  const today = React.useMemo(() => startOfToday(), []);
  const week = React.useMemo(() => weekFrom(anchor, today), [anchor, today]);
  const month = React.useMemo(() => monthCells(anchor), [anchor]);
  const shift = (dir: number) => {
    const d = new Date(view === "week" ? week[0] : anchor);
    if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir, 1);
    setAnchor(d);
  };
  /* Where a month and a day's times do not fit together (`data-fit="3"`,
     editorial.css): the month, then the day's times in its place. Julian, no
     scroll in the card, ever. */
  const [mstep, setMstep] = React.useState<"days" | "times">("days");
  const switchView = (v: "week" | "month") => {
    if (v === view) return;
    setMstep("days");
    // The new view is drawn in place, no flip.
    // Into the week from a month: the week of the day picked, when it is in that month.
    if (v === "week" && pick && fromIso(pick.date).getMonth() === anchor.getMonth()) setAnchor(fromIso(pick.date));
    setView(v);
  };
  /* Nothing to go back to before today. */
  const atStart = view === "week" ? +week[0] <= +today : anchor.getFullYear() * 12 + anchor.getMonth() <= today.getFullYear() * 12 + today.getMonth();

  return { view, setView, anchor, setAnchor, pick, setPick, chosen, setChosen, choose, today, week, month, shift, mstep, setMstep, switchView, atStart };
}

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  X,
  Trash2,
  Pencil,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";

const YEAR = 2026;
const ROWS = ["Photo", "Philip", "Smitz", "Oskar", "Agnes"] as const;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

const CATEGORIES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  retouch: { label: "Retouch", bg: "bg-orange-900/40", text: "text-orange-300", border: "border-orange-700" },
  selection: { label: "Selection", bg: "bg-pink-900/40", text: "text-pink-300", border: "border-pink-700" },
  naming: { label: "Naming", bg: "bg-cyan-900/40", text: "text-cyan-300", border: "border-cyan-700" },
  upload: { label: "Upload", bg: "bg-lime-900/40", text: "text-lime-300", border: "border-lime-700" },
  deadline: { label: "Deadline", bg: "bg-red-900/40", text: "text-red-300", border: "border-red-700" },
  meeting: { label: "Meeting", bg: "bg-zinc-700/60", text: "text-zinc-300", border: "border-zinc-600" },
  other: { label: "Other", bg: "bg-yellow-900/40", text: "text-yellow-300", border: "border-yellow-700" },
  holiday: { label: "Holiday", bg: "bg-zinc-800/80", text: "text-zinc-400 line-through", border: "border-zinc-700" },
  gallery: { label: "Gallery", bg: "bg-green-900/40", text: "text-green-300", border: "border-green-700" },
  details: { label: "Details", bg: "bg-blue-900/40", text: "text-blue-300", border: "border-blue-700" },
  mixed: { label: "Mixed", bg: "bg-purple-900/40", text: "text-purple-300", border: "border-purple-700" },
};

const CATEGORY_ROWS: string[][] = [
  ["retouch", "selection", "naming", "upload", "deadline"],
  ["meeting", "other", "holiday"],
  ["gallery", "details", "mixed"],
];

const AUTO_CATEGORIES = new Set(["gallery", "details", "mixed"]);

function getWeekDates(weekNum: number, year: number): Date[] {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const daysToMonday = dayOfWeek <= 1 ? 1 - dayOfWeek : 8 - dayOfWeek;
  const firstMonday = new Date(year, 0, 1 + daysToMonday);
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
  const days: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function getCurrentWeekNumber(): number {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfWeek = jan1.getDay();
  const daysToMonday = dayOfWeek <= 1 ? 1 - dayOfWeek : 8 - dayOfWeek;
  const firstMonday = new Date(now.getFullYear(), 0, 1 + daysToMonday);
  const diff = now.getTime() - firstMonday.getTime();
  return Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function formatDateShort(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

interface PlannerBlock {
  id: number;
  weekNumber: number;
  year: number;
  dayIndex: number;
  row: string;
  label: string;
  category: string;
  isMilestone: boolean;
  linkedSessionId: number | null;
}

interface AddPopup {
  weekNumber: number;
  dayIndex: number;
  row: string;
}

interface EditPopup {
  block: PlannerBlock;
}

function CategoryPicker({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">Category</label>
      <div className="space-y-1.5">
        {CATEGORY_ROWS.map((rowKeys, ri) => (
          <div key={ri} className="flex flex-wrap gap-1.5">
            {ri === 2 && (
              <span className="text-[10px] text-muted-foreground/60 w-full mb-0.5">Auto from shoots — manual override:</span>
            )}
            {rowKeys.map(key => {
              const cat = CATEGORIES[key];
              if (!cat) return null;
              const isAuto = AUTO_CATEGORIES.has(key);
              return (
                <button
                  key={key}
                  onClick={() => onSelect(key)}
                  className={cn(
                    "rounded border transition-colors",
                    isAuto ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
                    cat.bg, cat.text, cat.border,
                    selected === key ? "ring-2 ring-white/30" : isAuto ? "opacity-40 hover:opacity-70" : "opacity-60 hover:opacity-100"
                  )}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Planner() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const currentWeek = getCurrentWeekNumber();
  const [showPast, setShowPast] = React.useState(false);
  const [addPopup, setAddPopup] = React.useState<AddPopup | null>(null);
  const [editPopup, setEditPopup] = React.useState<EditPopup | null>(null);
  const [addLabel, setAddLabel] = React.useState("");
  const [addCategory, setAddCategory] = React.useState("other");
  const [addIsMilestone, setAddIsMilestone] = React.useState(false);
  const [editLabel, setEditLabel] = React.useState("");
  const [editCategory, setEditCategory] = React.useState("other");
  const currentWeekRef = React.useRef<HTMLDivElement>(null);

  const { data: blocks = [] } = useQuery<PlannerBlock[]>({
    queryKey: ["planner-blocks", YEAR],
    queryFn: () => api.getPlannerBlocks(YEAR),
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["sessions"],
    queryFn: api.getSessions,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.createPlannerBlock(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-blocks"] }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updatePlannerBlock(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-blocks"] }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deletePlannerBlock(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-blocks"] }); },
  });

  const sessionBlocks = React.useMemo(() => {
    const result: PlannerBlock[] = [];
    for (const s of sessions) {
      if (!s.date) continue;
      const d = new Date(s.date);
      const weekDayIndex = d.getDay() - 1;
      if (weekDayIndex < 0 || weekDayIndex > 4) continue;

      const jan1 = new Date(d.getFullYear(), 0, 1);
      const dayOfWeek = jan1.getDay();
      const daysToMonday = dayOfWeek <= 1 ? 1 - dayOfWeek : 8 - dayOfWeek;
      const firstMonday = new Date(d.getFullYear(), 0, 1 + daysToMonday);
      const diff = d.getTime() - firstMonday.getTime();
      const weekNum = Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
      if (d.getFullYear() !== YEAR) continue;

      const shotTypes = (s.shotType || "").toLowerCase();
      let cat = "gallery";
      if (shotTypes.includes("mixed")) cat = "mixed";
      else if (shotTypes.includes("details") || shotTypes.includes("detail")) cat = "details";

      result.push({
        id: -s.id,
        weekNumber: weekNum,
        year: d.getFullYear(),
        dayIndex: weekDayIndex,
        row: "Photo",
        label: `${s.modelName || "Shoot"} — ${s.brand}`,
        category: cat,
        isMilestone: false,
        linkedSessionId: s.id,
      });
    }
    return result;
  }, [sessions]);

  const allBlocks = React.useMemo(() => [...blocks, ...sessionBlocks], [blocks, sessionBlocks]);

  const getBlocksFor = (weekNum: number, dayIdx: number, row: string) =>
    allBlocks.filter(b => b.weekNumber === weekNum && b.year === YEAR && b.dayIndex === dayIdx && b.row === row);

  const getMilestones = (weekNum: number) =>
    allBlocks.filter(b => b.weekNumber === weekNum && b.year === YEAR && b.isMilestone);

  const weeks = React.useMemo(() => {
    const arr: number[] = [];
    for (let w = 1; w <= 52; w++) arr.push(w);
    return arr;
  }, []);

  const visibleWeeks = showPast ? weeks : weeks.filter(w => w >= currentWeek);

  const handleAdd = () => {
    if (!addPopup || !addLabel.trim()) return;
    createMut.mutate({
      weekNumber: addPopup.weekNumber,
      year: YEAR,
      dayIndex: addPopup.dayIndex,
      row: addPopup.row,
      label: addLabel.trim(),
      category: addCategory,
      isMilestone: addIsMilestone,
    });
    setAddPopup(null);
    setAddLabel("");
    setAddCategory("other");
    setAddIsMilestone(false);
  };

  const handleEdit = () => {
    if (!editPopup || !editLabel.trim()) return;
    updateMut.mutate({ id: editPopup.block.id, data: { label: editLabel.trim(), category: editCategory } });
    setEditPopup(null);
  };

  const handleDelete = () => {
    if (!editPopup) return;
    deleteMut.mutate(editPopup.block.id);
    setEditPopup(null);
  };

  const openAdd = (weekNumber: number, dayIndex: number, row: string) => {
    setAddPopup({ weekNumber, dayIndex, row });
    setAddLabel("");
    setAddCategory("other");
    setAddIsMilestone(false);
  };

  const openEdit = (block: PlannerBlock) => {
    if (block.linkedSessionId) return;
    setEditPopup({ block });
    setEditLabel(block.label);
    setEditCategory(block.category);
  };

  const scrollToCurrentWeek = () => {
    currentWeekRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Studio Planner</h1>
            <Badge variant="outline" className="text-xs">
              {YEAR}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPast(!showPast)}>
              {showPast ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              {showPast ? "Hide past schedule" : "Show past schedule"}
            </Button>
            <Button variant="outline" size="sm" onClick={scrollToCurrentWeek}>
              <Calendar className="w-4 h-4 mr-1" />
              Jump to this week
            </Button>
          </div>
        </div>

        <div className="space-y-0">
          {visibleWeeks.map(weekNum => {
            const dates = getWeekDates(weekNum, YEAR);
            const isCurrent = weekNum === currentWeek;
            const isPast = weekNum < currentWeek;
            const milestones = getMilestones(weekNum);

            return (
              <div
                key={weekNum}
                ref={isCurrent ? currentWeekRef : undefined}
                className={cn(
                  "border rounded-lg mb-4 overflow-hidden",
                  isCurrent && "ring-2 ring-primary/50",
                  isPast && "opacity-60"
                )}
              >
                <div className={cn(
                  "px-4 py-2 flex items-center justify-between",
                  isCurrent ? "bg-primary/10" : "bg-muted/30"
                )}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold uppercase tracking-wider">
                      Week {weekNum}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateShort(dates[0])} – {formatDateShort(dates[4])}
                    </span>
                    {isCurrent && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">Current</Badge>}
                  </div>
                  <button
                    onClick={() => openAdd(weekNum, 0, "Photo")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Add milestone"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {milestones.length > 0 && (
                  <div className="px-4 py-1.5 bg-red-900/20 border-b border-red-800/30">
                    <div className="flex flex-wrap gap-2">
                      {milestones.map(m => (
                        <button
                          key={m.id}
                          onClick={() => openEdit(m)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-red-900/50 text-red-300 border border-red-700 hover:bg-red-900/70 transition-colors"
                        >
                          🚩 {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-xs table-fixed">
                    <colgroup>
                      <col className="w-20" />
                      <col /><col /><col /><col /><col />
                    </colgroup>
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="w-20 px-3 py-1.5 text-left font-semibold text-muted-foreground"></th>
                        {dates.map((d, i) => {
                          const isToday = d.toDateString() === new Date().toDateString();
                          return (
                            <th key={i} className={cn(
                              "px-2 py-1.5 text-center font-medium",
                              isToday ? "text-primary" : "text-muted-foreground"
                            )}>
                              <div>{DAYS[i]}</div>
                              <div className="text-[10px] font-normal">{d.getDate()}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {ROWS.map(row => (
                        <tr key={row} className="border-b last:border-b-0">
                          <td className="px-3 py-1.5 font-semibold text-muted-foreground whitespace-nowrap align-top">
                            {row}
                          </td>
                          {dates.map((_, dayIdx) => {
                            const cellBlocks = getBlocksFor(weekNum, dayIdx, row);
                            return (
                              <td
                                key={dayIdx}
                                className="px-1 py-1 align-top border-l group cursor-pointer hover:bg-muted/20 transition-colors overflow-hidden"
                                onClick={(e) => {
                                  if ((e.target as HTMLElement).closest("[data-block]")) return;
                                  openAdd(weekNum, dayIdx, row);
                                }}
                              >
                                <div className="space-y-0.5 min-h-[28px]">
                                  {cellBlocks.map(b => {
                                    const cat = CATEGORIES[b.category] || CATEGORIES.other;
                                    return (
                                      <button
                                        key={b.id}
                                        data-block
                                        onClick={(e) => { e.stopPropagation(); openEdit(b); }}
                                        className={cn(
                                          "w-full text-left px-1.5 py-0.5 rounded text-[11px] leading-tight border truncate transition-colors",
                                          cat.bg, cat.text, cat.border,
                                          b.linkedSessionId ? "cursor-default opacity-90" : "hover:opacity-80"
                                        )}
                                        title={b.linkedSessionId ? `Synced from Book Shoot` : b.label}
                                      >
                                        {b.label}
                                      </button>
                                    );
                                  })}
                                  <div className="hidden group-hover:flex items-center justify-center pt-0.5">
                                    <Plus className="w-3 h-3 text-muted-foreground/50" />
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {addPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddPopup(null)}>
          <div className="bg-card border rounded-lg p-5 w-full max-w-sm space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Add Block</h3>
              <button onClick={() => setAddPopup(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground">
              Week {addPopup.weekNumber} · {DAYS[addPopup.dayIndex]} · {addPopup.row}
            </div>
            <Input
              value={addLabel}
              onChange={e => setAddLabel(e.target.value)}
              placeholder="Activity name"
              className="h-8 text-sm"
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleAdd()}
            />
            <CategoryPicker selected={addCategory} onSelect={setAddCategory} />
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={addIsMilestone}
                onChange={e => setAddIsMilestone(e.target.checked)}
                className="rounded"
              />
              Milestone banner (spans full week)
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setAddPopup(null)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={!addLabel.trim() || createMut.isPending}>
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {editPopup && !editPopup.block.linkedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditPopup(null)}>
          <div className="bg-card border rounded-lg p-5 w-full max-w-sm space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Edit Block</h3>
              <button onClick={() => setEditPopup(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <Input
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleEdit()}
            />
            <CategoryPicker selected={editCategory} onSelect={setEditCategory} />
            <div className="flex gap-2 justify-end">
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
              <Button size="sm" onClick={handleEdit} disabled={!editLabel.trim()}>
                <Check className="w-3 h-3 mr-1" /> Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

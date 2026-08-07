import { create } from 'zustand';

interface FlamingoState {
  joined: string[]; acceptedTasks: string[]; joinedGroups: string[]; toast: string;
  joinProtest: (id: string) => void; acceptTask: (id: string) => void; joinGroup: (id: string) => void; notify: (message: string) => void; clearToast: () => void;
}
export const useFlamingoStore = create<FlamingoState>((set) => ({
  joined: [], acceptedTasks: [], joinedGroups: [], toast: '',
  joinProtest: (id) => set((s) => ({ joined: s.joined.includes(id) ? s.joined : [...s.joined, id], toast:'U bashkove. Pjesëmarrja jote mbetet private.' })),
  acceptTask: (id) => set((s) => ({ acceptedTasks: s.acceptedTasks.includes(id) ? s.acceptedTasks : [...s.acceptedTasks, id], toast:'Detyra u shtua te profili yt.' })),
  joinGroup: (id) => set((s) => ({ joinedGroups: s.joinedGroups.includes(id) ? s.joinedGroups : [...s.joinedGroups, id], toast:'Kërkesa për grupin u pranua.' })),
  notify: (toast) => set({ toast }), clearToast: () => set({ toast:'' })
}));

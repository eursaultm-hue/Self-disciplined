import { KnowledgePoint } from "./courseKnowledge";
import { Task, id, today } from "./domain";
export type KnowledgeStatus = "UNKNOWN" | "LEARNING" | "MASTERED";
export type ReviewState = { knowledgePointId: string; status: KnowledgeStatus; reviewDueAt?: string; interval: number; ease: number; reviewCount: number; lastReviewedAt?: string; failureCount: number };
export const defaultReviewState = (knowledgePointId: string): ReviewState => ({ knowledgePointId, status: "UNKNOWN", interval: 1, ease: 2.5, reviewCount: 0, failureCount: 0 });
export function scheduleReview(state: ReviewState, success: boolean, at = today()): ReviewState {
 const next={...state,lastReviewedAt:at,reviewCount:state.reviewCount+1};
 if(!success)return {...next,status:"LEARNING",interval:1,ease:Math.max(1.3,state.ease-0.2),failureCount:state.failureCount+1,reviewDueAt:at};
 const interval=state.reviewCount===0?1:Math.max(1,Math.round(state.interval*state.ease));
 return {...next,status:interval>=14?"MASTERED":"LEARNING",interval,ease:Math.min(3,state.ease+0.1),reviewDueAt:addDays(at,interval)};
}
function addDays(date:string,days:number){const d=new Date(date+"T12:00:00");d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
export function isReviewDue(state:ReviewState,at=today()){return !!state.reviewDueAt&&state.reviewDueAt<=at;}
export function buildReviewTask(point:KnowledgePoint,state:ReviewState):Task{return{id:id(),title:`复习：${point.title}`,courseId:point.courseId,knowledgePointId:point.id,priorityTier:"MUST",status:"TODO",plannedDate:today(),plannedMinutes:state.status==="UNKNOWN"?20:15,actualMinutes:0};}

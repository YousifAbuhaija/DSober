import {
  User,
  Event,
  RideRequest,
  DDSession,
  AdminAlert,
  SEPAttempt,
} from '../types/database.types';
import { NotificationHistoryItem } from '../types/notifications';

export const mapUser = (d: any): User => ({
  id: d.id,
  email: d.email,
  name: d.name,
  birthday: new Date(d.birthday),
  age: d.age,
  gender: d.gender,
  groupId: d.group_id,
  role: d.role,
  isDD: d.is_dd,
  ddStatus: d.dd_status,
  carMake: d.car_make,
  carModel: d.car_model,
  carPlate: d.car_plate,
  phoneNumber: d.phone_number,
  licensePhotoUrl: d.license_photo_url,
  profilePhotoUrl: d.profile_photo_url,
  createdAt: new Date(d.created_at),
  updatedAt: new Date(d.updated_at),
});

export const mapEvent = (d: any): Event => ({
  id: d.id,
  groupId: d.group_id,
  name: d.name,
  description: d.description,
  dateTime: new Date(d.date_time),
  locationText: d.location_text,
  status: d.status,
  createdByUserId: d.created_by_user_id,
  createdAt: new Date(d.created_at),
});

export const mapRideRequest = (d: any): RideRequest => ({
  id: d.id,
  ddUserId: d.dd_user_id,
  riderUserId: d.rider_user_id,
  eventId: d.event_id,
  pickupLocationText: d.pickup_location_text,
  pickupLatitude: d.pickup_latitude,
  pickupLongitude: d.pickup_longitude,
  status: d.status,
  createdAt: new Date(d.created_at),
  acceptedAt: d.accepted_at ? new Date(d.accepted_at) : undefined,
  pickedUpAt: d.picked_up_at ? new Date(d.picked_up_at) : undefined,
  completedAt: d.completed_at ? new Date(d.completed_at) : undefined,
});

export const mapDDSession = (d: any): DDSession => ({
  id: d.id,
  userId: d.user_id,
  eventId: d.event_id,
  startedAt: new Date(d.started_at),
  endedAt: d.ended_at ? new Date(d.ended_at) : undefined,
  isActive: d.is_active,
});

export const mapAdminAlert = (d: any): AdminAlert => ({
  id: d.id,
  type: d.type,
  userId: d.user_id,
  eventId: d.event_id,
  sepAttemptId: d.sep_attempt_id,
  resolvedByAdminId: d.resolved_by_admin_id,
  resolvedAt: d.resolved_at ? new Date(d.resolved_at) : undefined,
  createdAt: new Date(d.created_at),
});

export const mapSEPAttempt = (d: any): SEPAttempt => ({
  id: d.id,
  userId: d.user_id,
  eventId: d.event_id,
  reactionAvgMs: d.reaction_avg_ms,
  phraseDurationSec: d.phrase_duration_sec,
  selfieUrl: d.selfie_url,
  result: d.result,
  createdAt: new Date(d.created_at),
});

export const mapNotification = (d: any): NotificationHistoryItem => ({
  id: d.id,
  userId: d.user_id,
  type: d.type,
  title: d.title,
  body: d.body,
  data: d.data,
  priority: d.priority,
  read: d.read,
  sentAt: d.sent_at ? new Date(d.sent_at) : undefined,
  deliveredAt: d.delivered_at ? new Date(d.delivered_at) : undefined,
  failedAt: d.failed_at ? new Date(d.failed_at) : undefined,
  failureReason: d.failure_reason,
  retryCount: d.retry_count ?? 0,
  createdAt: new Date(d.created_at),
});

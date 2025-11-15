// Database types for Supabase tables

export interface User {
  id: string;
  email: string;
  name: string;
  birthday: Date;
  age?: number;
  gender: string;
  groupId: string;
  role: 'admin' | 'member';
  isDD: boolean;
  ddStatus: 'none' | 'active' | 'revoked';
  carMake?: string;
  carModel?: string;
  carPlate?: string;
  phoneNumber?: string;
  licensePhotoUrl?: string;
  profilePhotoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  name: string;
  accessCode: string;
  createdAt: Date;
}

export interface Event {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  dateTime: Date;
  locationText: string;
  status: 'upcoming' | 'active' | 'completed';
  createdByUserId: string;
  createdAt: Date;
}

export interface DDRequest {
  id: string;
  eventId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export interface DDAssignment {
  id: string;
  eventId: string;
  userId: string;
  status: 'assigned' | 'revoked';
  updatedAt: Date;
}

export interface SEPBaseline {
  id: string;
  userId: string;
  reactionAvgMs: number;
  phraseDurationSec: number;
  selfieUrl: string;
  createdAt: Date;
}

export interface SEPAttempt {
  id: string;
  userId: string;
  eventId?: string;
  reactionAvgMs: number;
  phraseDurationSec: number;
  selfieUrl: string;
  result: 'pass' | 'fail';
  createdAt: Date;
}

export interface DDSession {
  id: string;
  userId: string;
  eventId: string;
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;
}

export interface AdminAlert {
  id: string;
  type: string;
  userId: string;
  eventId: string;
  sepAttemptId: string;
  createdAt: Date;
  resolvedByAdminId?: string;
  resolvedAt?: Date;
}

export interface RideRequest {
  id: string;
  ddUserId: string;
  riderUserId: string;
  eventId: string;
  pickupLocationText: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  status: 'pending' | 'accepted' | 'picked_up' | 'completed' | 'cancelled';
  createdAt: Date;
  acceptedAt?: Date;
  pickedUpAt?: Date;
  completedAt?: Date;
}

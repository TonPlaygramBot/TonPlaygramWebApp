import mongoose from 'mongoose';
const { Schema } = mongoose;
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);
const connection = new Schema({
  owner: { type: String, required: true, index: true }, platform: String, providerId: String,
  name: String, status: { type: String, default: 'connected' }, credentials: { type: String, select: false },
  expiresAt: Date
}, { timestamps: true });
connection.index({ owner: 1, platform: 1, providerId: 1 }, { unique: true });
export const Connection = model('CreatorConnection', connection);
const oauth = new Schema({ stateHash: { type: String, unique: true }, binding: String, owner: String, platform: String, verifier: String, returnTo: String, expiresAt: Date });
oauth.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const OAuth = model('CreatorOAuth', oauth);
export const Media = model('CreatorMedia', new Schema({ owner: { type: String, index: true }, name: String, size: Number, mime: String, offset: { type: Number, default: 0 }, ready: { type: Boolean, default: false }, duration: Number, width: Number, height: Number }, { timestamps: true }));
const delivery = new Schema({ connectionId: String, platform: String, name: String, status: { type: String, default: 'queued' }, externalId: String, stage: String, url: String, message: String, startedAt: Date, nextAt: Date, attempts: { type: Number, default: 0 } });
const post = new Schema({
  owner: { type: String, required: true, index: true }, requestId: String, title: String, caption: String,
  mediaId: String, targets: [String], overrides: { type: Map, of: String }, settings: Schema.Types.Mixed,
  status: { type: String, default: 'draft', index: true }, scheduledAt: Date, deliveries: [delivery]
}, { timestamps: true });
post.index({ owner: 1, requestId: 1 }, { unique: true });
export const Post = model('CreatorPost', post);
export const Live = model('CreatorLive', new Schema({ owner: { type: String, index: true }, title: String, status: String, heartbeat: Date, destinations: [{ connectionId: String, platform: String, remote: Schema.Types.Mixed }] }, { timestamps: true }));

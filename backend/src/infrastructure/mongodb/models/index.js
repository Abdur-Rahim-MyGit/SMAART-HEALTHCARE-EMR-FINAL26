'use strict';
/**
 * MongoDB collections. Each one has a single documented purpose and references
 * PostgreSQL UUIDs; none of them duplicates a PostgreSQL source of truth.
 */
const { mongoose } = require('../connection');
const { uuidField } = require('../tenantModel');

const base = { clinicId: { ...uuidField(true), index: true }, createdBy: uuidField(false), updatedBy: uuidField(false) };

/** clinical_notes: free-form narrative (SOAP etc.) for an encounter/patient. */
const ClinicalNote = mongoose.model('ClinicalNote', new mongoose.Schema({ ...base, patientId: { ...uuidField(true), index: true }, encounterId: { ...uuidField(false), index: true }, practitionerId: uuidField(false), noteType: { type: String, default: 'progress', enum: ['progress', 'soap', 'discharge', 'consultation', 'nursing', 'other'] }, title: { type: String, maxlength: 200 }, content: { type: mongoose.Schema.Types.Mixed, required: true }, status: { type: String, default: 'final', enum: ['draft', 'final', 'amended'] }, tags: [{ type: String, maxlength: 50 }] }, { timestamps: true, collection: 'clinical_notes' }));

/** clinical_assessments: scored questionnaires and assessment instruments. */
const ClinicalAssessment = mongoose.model('ClinicalAssessment', new mongoose.Schema({ ...base, patientId: { ...uuidField(true), index: true }, encounterId: uuidField(false), instrument: { type: String, required: true, maxlength: 100 }, responses: { type: mongoose.Schema.Types.Mixed, required: true }, score: mongoose.Schema.Types.Mixed, interpretation: String }, { timestamps: true, collection: 'clinical_assessments' }));

/** dynamic_forms: clinic-defined form templates and their submissions. */
const DynamicForm = mongoose.model('DynamicForm', new mongoose.Schema({ ...base, name: { type: String, required: true, maxlength: 150 }, version: { type: Number, default: 1 }, schema: { type: mongoose.Schema.Types.Mixed, required: true }, isActive: { type: Boolean, default: true } }, { timestamps: true, collection: 'dynamic_forms' }));
const DynamicFormSubmission = mongoose.model('DynamicFormSubmission', new mongoose.Schema({ ...base, formId: { type: mongoose.Schema.Types.ObjectId, ref: 'DynamicForm', required: true }, patientId: { ...uuidField(false), index: true }, encounterId: uuidField(false), data: { type: mongoose.Schema.Types.Mixed, required: true } }, { timestamps: true, collection: 'dynamic_form_submissions' }));

/** patient_activity_logs: high-volume activity/login history (legacy case-log activity). */
const PatientActivityLog = mongoose.model('PatientActivityLog', new mongoose.Schema({ ...base, patientId: { ...uuidField(true), index: true }, action: { type: String, required: true, maxlength: 60 }, description: { type: String, maxlength: 1000 }, performedBy: uuidField(false), performedByName: String, metadata: mongoose.Schema.Types.Mixed, occurredAt: { type: Date, default: Date.now, index: true } }, { timestamps: true, collection: 'patient_activity_logs' }));

/** community_posts: clinic community hub content. */
const CommunityPost = mongoose.model('CommunityPost', new mongoose.Schema({ ...base, authorId: { ...uuidField(true), index: true }, author: { type: String, maxlength: 120 }, authorRole: String, title: { type: String, required: true, maxlength: 200 }, content: { type: String, required: true, maxlength: 20000 }, excerpt: { type: String, maxlength: 500 }, category: { type: String, default: 'General', maxlength: 60, index: true }, tags: [{ type: String, maxlength: 50 }], featured: { type: Boolean, default: false }, published: { type: Boolean, default: true }, status: { type: String, default: 'Published', enum: ['Draft', 'Published', 'Archived'] }, views: { type: Number, default: 0 }, likes: { type: Number, default: 0 }, likedBy: [{ userId: uuidField(true), likedAt: { type: Date, default: Date.now } }], comments: [{ userId: uuidField(true), author: String, content: { type: String, maxlength: 2000 }, createdAt: { type: Date, default: Date.now } }], legacyId: String }, { timestamps: true, collection: 'community_posts' }));

/** integration_payloads: raw inbound/outbound payloads from external systems (Consultant, Patient app, labs). */
const IntegrationPayload = mongoose.model('IntegrationPayload', new mongoose.Schema({ clinicId: { ...uuidField(false), index: true }, system: { type: String, required: true, index: true }, direction: { type: String, enum: ['inbound', 'outbound'], required: true }, resourceType: String, resourceId: String, payload: { type: mongoose.Schema.Types.Mixed, required: true }, status: { type: String, default: 'received' }, error: String, requestId: String }, { timestamps: true, collection: 'integration_payloads' }));

/** fhir_payload_snapshots: FHIR resources as served/received, kept for interoperability audit. */
const FhirPayloadSnapshot = mongoose.model('FhirPayloadSnapshot', new mongoose.Schema({ clinicId: { ...uuidField(false), index: true }, resourceType: { type: String, required: true, index: true }, resourceId: { type: String, required: true, index: true }, direction: { type: String, enum: ['export', 'import'], default: 'export' }, resource: { type: mongoose.Schema.Types.Mixed, required: true }, actorId: uuidField(false), requestId: String }, { timestamps: true, collection: 'fhir_payload_snapshots' }));

CommunityPost.schema.index({ clinicId: 1, status: 1, createdAt: -1 });
CommunityPost.schema.index({ title: 'text', content: 'text' });
ClinicalNote.schema.index({ clinicId: 1, patientId: 1, createdAt: -1 });
PatientActivityLog.schema.index({ clinicId: 1, patientId: 1, occurredAt: -1 });

module.exports = { ClinicalNote, ClinicalAssessment, DynamicForm, DynamicFormSubmission, PatientActivityLog, CommunityPost, IntegrationPayload, FhirPayloadSnapshot };

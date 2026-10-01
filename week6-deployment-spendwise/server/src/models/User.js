/**
 * User model
 * ----------
 * Passwords are hashed with bcrypt in a pre-save hook and never returned in
 * JSON (select:false + toJSON transform). Email is unique and lower-cased.
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    currency: { type: String, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret) {
        ret.id = ret._id
        delete ret._id
        delete ret.password
        return ret
      },
    },
  },
)

// Hash the password whenever it is created or changed
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS)
})

/** Constant-time password check. */
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

export const User = mongoose.model('User', userSchema)

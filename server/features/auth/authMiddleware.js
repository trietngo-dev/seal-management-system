const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const EventRole = mongoose.model('EventRole');

const JWT_SECRET = require('./jwtSecret');

/**
 * Middleware to verify user JWT token.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động. Vui lòng liên hệ Admin.',
        isDeactivated: true
      });
    }

    // Verify session ID
    if (decoded.sessionId && user.activeSessionId !== decoded.sessionId) {
      return res.status(401).json({ 
        message: 'Phiên đăng nhập đã hết hạn hoặc tài khoản được đăng nhập từ thiết bị khác.',
        isSessionExpired: true
      });
    }

    // Update lastActiveAt heartbeat (throttled to once every 25 seconds to reduce DB/Redis updates)
    if (!user.lastActiveAt || Date.now() - new Date(user.lastActiveAt).getTime() > 25000) {
      user.lastActiveAt = new Date();
      await user.save();
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(403).json({ message: 'Invalid or expired authentication token.' });
  }
}

/**
 * Middleware to verify the user is a system admin.
 */
function requireSystemAdmin(req, res, next) {
  if (!req.user || !req.user.isSystemAdmin) {
    return res.status(403).json({ message: 'Access denied. System Administrator privileges required.' });
  }
  next();
}

/**
 * Middleware to verify the user is a system admin or a student assistant (CTSV).
 */
function requireAdminOrAssistant(req, res, next) {
  if (!req.user || (!req.user.isSystemAdmin && !req.user.isStudentAssistant)) {
    return res.status(403).json({ message: 'Access denied. Administrator or Student Assistant privileges required.' });
  }
  next();
}

/**
 * Higher-order middleware to verify if user has a specific role in a specific event.
 * Expects eventId in req.params.eventId, req.body.eventId, or req.query.eventId
 * @param {Array<string>} allowedRoles - List of allowed roles (e.g. ['student_assistant', 'judge'])
 */
function requireEventRole(allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    // System Admins bypass event-specific checks
    if (req.user.isSystemAdmin) {
      return next();
    }

    const eventId = req.params.eventId || req.body.eventId || req.query.eventId;
    if (!eventId) {
      return res.status(400).json({ message: 'Event ID context is required to verify permissions.' });
    }

    try {
      // A user can hold several roles in one event (e.g. mentor + judge), so check all of them.
      const eventRoles = await EventRole.find({
        userId: req.user._id,
        eventId: eventId,
        status: 'active'
      }).populate('eventId');

      if (eventRoles.length === 0) {
        return res.status(403).json({
          message: `Access denied. You do not have roles in this event.`
        });
      }

      // If the event is completed or cancelled, demote role to participant
      const effectiveRoleOf = (role) => (
        role.eventId && (role.eventId.status === 'completed' || role.eventId.status === 'cancelled')
          ? 'participant'
          : role.role
      );
      const eventRole = eventRoles.find(role => allowedRoles.includes(effectiveRoleOf(role)));
      const effectiveRole = eventRole ? effectiveRoleOf(eventRole) : null;

      if (!eventRole) {
        return res.status(403).json({ 
          message: `Access denied. You do not have the required role(s) [${allowedRoles.join(', ')}] in this event.` 
        });
      }

      req.eventRole = effectiveRole;
      req.eventTrackId = eventRole.trackId;
      req.eventRoundId = eventRole.roundId;
      next();
    } catch (error) {
      console.error('Error checking event role:', error.message);
      return res.status(500).json({ message: 'Error checking user permissions.' });
    }
  };
}

module.exports = {
  authenticateToken,
  requireSystemAdmin,
  requireAdminOrAssistant,
  requireEventRole
};

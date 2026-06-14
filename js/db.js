/* ═══════════════════════════════════════════════════════
   DB — CRUD operations for all entities
   ═══════════════════════════════════════════════════════ */

(function () {
  const db = () => ZAP.dbRef;

  // ═══════════════════════════════════════════════════════
  // Users
  // ═══════════════════════════════════════════════════════

  async function getUserByUid(uid) {
    if (!db()) return null;
    const snap = await db().ref('users/' + uid).get();
    return snap.exists() ? snap.val() : null;
  }

  async function getUserByLogin(login) {
    if (!db()) return null;
    const uidSnap = await db().ref('logins/' + login.toLowerCase()).get();
    if (!uidSnap.exists()) return null;
    return getUserByUid(uidSnap.val());
  }

  async function getUserById(uniqueId) {
    if (!db()) return null;
    const uidSnap = await db().ref('ids/' + uniqueId).get();
    if (!uidSnap.exists()) return null;
    return getUserByUid(uidSnap.val());
  }

  async function getAllUsers(limit = 100) {
    if (!db()) return [];
    const snap = await db().ref('users').orderByChild('createdAt').limitToLast(limit).get();
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(c => { list.push(c.val()); });
    return list.reverse();
  }

  async function updateUserRole(uid, newRole) {
    if (!db()) return;
    await db().ref('users/' + uid + '/role').set(newRole);
  }

  async function banUser(uid, banned, until = null) {
    if (!db()) return;
    await db().ref('users/' + uid + '/banned').set(banned);
    if (banned) {
      await db().ref('users/' + uid + '/bannedAt').set(Date.now());
      if (until) await db().ref('users/' + uid + '/bannedUntil').set(until);
      else await db().ref('users/' + uid + '/bannedUntil').remove();
    } else {
      await db().ref('users/' + uid + '/bannedAt').remove();
      await db().ref('users/' + uid + '/bannedUntil').remove();
    }
  }

  // ═══════════════════════════════════════════════════════
  // Invitations (personal)
  // ═══════════════════════════════════════════════════════

  async function createInvite(inv) {
    if (!db()) return;
    await db().ref('invites/' + inv.id).set(inv);
    await db().ref('statuses/' + inv.id).set('pending');
    // Save to user's invite list
    if (inv.creatorUid) {
      await db().ref('user-invites/' + inv.creatorUid + '/' + inv.id).set({
        id: inv.id, to: inv.to, type: inv.type,
        date: inv.date, time: inv.time, status: 'pending',
        created: inv.created,
        recipientUid: inv.recipientUid || null,
      });
    }
  }

  async function getInvite(invId) {
    if (!db()) return null;
    const snap = await db().ref('invites/' + invId).get();
    return snap.exists() ? snap.val() : null;
  }

  async function getUserInvites(uid) {
    if (!db()) return [];
    const snap = await db().ref('user-invites/' + uid).get();
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(c => { list.push(c.val()); });
    return list.sort((a, b) => (b.created || 0) - (a.created || 0));
  }

  async function updateInviteStatus(invId, status, uid) {
    if (!db()) return;
    await db().ref('statuses/' + invId).set(status);
    // Update in user's invite list
    if (uid) {
      await db().ref('user-invites/' + uid + '/' + invId + '/status').set(status);
    }
  }

  async function deleteInvite(invId, uid) {
    if (!db()) return;
    await db().ref('invites/' + invId).remove();
    await db().ref('statuses/' + invId).remove();
    await db().ref('reschedule/' + invId).remove();
    if (uid) {
      await db().ref('user-invites/' + uid + '/' + invId).remove();
    }
  }

  // ── Reschedule ──
  async function saveReschedule(invId, data) {
    if (!db()) return;
    await db().ref('reschedule/' + invId).set({ ...data, ts: Date.now() });
    await db().ref('statuses/' + invId).set('reschedule');
  }

  async function getReschedule(invId) {
    if (!db()) return null;
    const snap = await db().ref('reschedule/' + invId).get();
    return snap.exists() ? snap.val() : null;
  }

  // ═══════════════════════════════════════════════════════
  // Group Invitations
  // ═══════════════════════════════════════════════════════

  async function createGroupInvite(inv) {
    if (!db()) return;
    await db().ref('group-invites/' + inv.id).set(inv);
    // Save to creator's list
    if (inv.creatorUid) {
      await db().ref('user-invites/' + inv.creatorUid + '/' + inv.id).set({
        id: inv.id, type: inv.type, date: inv.date, time: inv.time,
        status: 'pending', created: inv.created, isGroup: true,
        title: inv.title || '',
      });
    }
  }

  async function getGroupInvite(invId) {
    if (!db()) return null;
    const snap = await db().ref('group-invites/' + invId).get();
    return snap.exists() ? snap.val() : null;
  }

  async function joinGroupInvite(invId, participant) {
    if (!db()) return;
    const key = participant.uid || participant.name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
    await db().ref('group-invites/' + invId + '/members/' + key).set({
      name: participant.name,
      uid: participant.uid || null,
      status: participant.status || 'accepted',
      joinedAt: Date.now(),
    });
  }

  async function updateGroupMemberStatus(invId, memberKey, status) {
    if (!db()) return;
    await db().ref('group-invites/' + invId + '/members/' + memberKey + '/status').set(status);
  }

  // Send group invite to friends via notifications
  async function sendGroupInviteToFriends(invId, friendUids, invData) {
    for (const fuid of friendUids) {
      await db().ref('group-invites/' + invId + '/invited/' + fuid).set({
        status: 'pending', sentAt: Date.now(),
      });
      // Send notification
      await ZAP.notifications.addNotification(fuid, {
        type: 'group-invite',
        title: 'Групове запрошення',
        body: `${invData.creatorName} запрошує вас: ${invData.title || ZAP.utils.TYPE_MAP[invData.type]?.l || 'Зустріч'}`,
        inviteId: invId,
        fromUid: invData.creatorUid,
        fromName: invData.creatorName,
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  // Friends
  // ═══════════════════════════════════════════════════════

  async function sendFriendRequest(fromUid, toUid, fromName) {
    if (!db()) return;
    // Check if already friends
    const existing = await db().ref('friends/' + fromUid + '/' + toUid).get();
    if (existing.exists()) throw new Error('Вже у друзях');

    // Check if request already sent (check recipient's notifications)
    const notifsSnap = await db().ref('notifications/' + toUid)
      .orderByChild('type').equalTo('friend-request').get();
    if (notifsSnap.exists()) {
      let alreadySent = false;
      notifsSnap.forEach(c => { if (c.val().fromUid === fromUid) alreadySent = true; });
      if (alreadySent) throw new Error('Запит вже надіслано');
    }

    // Send notification (no cross-user write)
    await ZAP.notifications.addNotification(toUid, {
      type: 'friend-request',
      title: 'Запит на дружбу',
      body: `${fromName} хоче додати вас у друзі`,
      fromUid, fromName,
    });

    return 'sent';
  }

  async function acceptFriendRequest(myUid, fromUid) {
    if (!db()) return;
    
    // Check if already friends (idempotent operation)
    const alreadyFriends = await db().ref('friends/' + myUid + '/' + fromUid).get();
    if (alreadyFriends.exists()) {
      return;
    }
    
    const myProfile = await getUserByUid(myUid);
    const theirProfile = await getUserByUid(fromUid);

    // Write ONLY to own friends list
    await db().ref('friends/' + myUid + '/' + fromUid).set({
      uid: fromUid, name: theirProfile?.name || '', addedAt: Date.now(),
    });

    // Notify the other user to add us
    await ZAP.notifications.addNotification(fromUid, {
      type: 'friend-accepted',
      title: '✓ Запит прийнято',
      body: `${myProfile?.name || 'Хтось'} прийняв вашу пропозицію дружби`,
      fromUid: myUid, fromName: myProfile?.name || '',
    });
  }

  async function declineFriendRequest(myUid, fromUid) {
    if (!db()) return;
    // Remove only from own
    const req = await db().ref('friend-requests/' + myUid + '/' + fromUid).get();
    if (req.exists()) {
      await db().ref('friend-requests/' + myUid + '/' + fromUid).remove();
    }
  }

  async function removeFriend(myUid, friendUid) {
    if (!db()) return;
    // Remove only from own list
    await db().ref('friends/' + myUid + '/' + friendUid).remove();
    // Notify the other user
    const myProfile = await getUserByUid(myUid);
    await ZAP.notifications.addNotification(friendUid, {
      type: 'friend-removed',
      title: 'Друга видалено',
      body: `${myProfile?.name || 'Хтось'} видалив вас з друзів`,
      fromUid: myUid, fromName: myProfile?.name || '',
    });
  }

  async function getFriends(uid) {
    if (!db()) return [];
    const snap = await db().ref('friends/' + uid).get();
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(c => { list.push(c.val()); });

    // Fetch fresh profile data (avatar + name) for each friend
    for (const f of list) {
      const pf = await getUserByUid(f.uid);
      if (pf) {
        if (pf.avatar) f.avatar = pf.avatar;
        if (pf.name) f.name = pf.name;
        if (pf.uniqueId) f.uniqueId = pf.uniqueId;
        if (pf.lastSeen) f.lastSeen = pf.lastSeen;
      }
    }
    return list;
  }

  async function getFriendRequests(uid) {
    if (!db()) return [];
    const snap = await db().ref('friend-requests/' + uid).get();
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(c => { list.push(c.val()); });
    return list;
  }

  // ═══════════════════════════════════════════════════════
  // Reports / Complaints
  // ═══════════════════════════════════════════════════════

  async function createReport(report) {
    if (!db()) return;
    const ref = db().ref('reports').push();
    await ref.set({
      id: ref.key,
      ...report,
      status: 'pending', // pending, resolved, dismissed
      createdAt: Date.now(),
    });
  }

  async function getReports() {
    if (!db()) return [];
    const snap = await db().ref('reports').orderByChild('createdAt').get();
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(c => { list.push(c.val()); });
    return list.reverse();
  }

  async function resolveReport(reportId, action, moderatorUid) {
    if (!db()) return;
    await db().ref('reports/' + reportId).update({
      status: action, // 'resolved' or 'dismissed'
      resolvedBy: moderatorUid,
      resolvedAt: Date.now(),
    });
  }

  // ═══════════════════════════════════════════════════════
  // Stats (for dashboard)
  // ═══════════════════════════════════════════════════════

  async function getStats() {
    if (!db()) return {};

    let usersSnap = null, invitesSnap = null, groupSnap = null, reportsSnap = null;
    let statusesSnap = null, friendsSnap = null;

    console.log('[DASH] getStats start', Date.now());
    try { usersSnap = await db().ref('users').get(); console.log('[DASH] 1/6 users OK', Date.now()); } catch (e) { console.warn('[DASH] 1/6 users FAIL:', e); }
    try { invitesSnap = await db().ref('invites').get(); console.log('[DASH] 2/6 invites OK', Date.now()); } catch (e) { console.warn('[DASH] 2/6 invites FAIL:', e); }
    try { groupSnap = await db().ref('group-invites').get(); console.log('[DASH] 3/6 group-invites OK', Date.now()); } catch (e) { console.warn('[DASH] 3/6 group-invites FAIL:', e); }
    try { reportsSnap = await db().ref('reports').get(); console.log('[DASH] 4/6 reports OK', Date.now()); } catch (e) { console.warn('[DASH] 4/6 reports FAIL:', e); }
    try { statusesSnap = await db().ref('statuses').get(); console.log('[DASH] 5/6 statuses OK', Date.now()); } catch (e) { console.warn('[DASH] 5/6 statuses FAIL:', e); }
    try { friendsSnap = await db().ref('friends').get(); console.log('[DASH] 6/6 friends OK', Date.now()); } catch (e) { console.warn('[DASH] 6/6 friends FAIL:', e); }

    const users = [];
    if (usersSnap && usersSnap.exists()) usersSnap.forEach(c => { users.push(c.val()); });

    let totalInvites = 0;
    let personalInvitesCount = 0;
    let groupInvitesCount = 0;
    const typeCounts = {};
    const personalInvites = [];
    const groupInvites = [];

    if (invitesSnap && invitesSnap.exists()) {
      invitesSnap.forEach(c => {
        totalInvites++;
        personalInvitesCount++;
        const inv = c.val();
        inv.id = c.key;
        personalInvites.push(inv);
        if (inv && inv.type) {
          typeCounts[inv.type] = (typeCounts[inv.type] || 0) + 1;
        }
      });
    }
    if (groupSnap && groupSnap.exists()) {
      groupSnap.forEach(c => {
        totalInvites++;
        groupInvitesCount++;
        const inv = c.val();
        inv.id = c.key;
        inv.isGroup = true;
        groupInvites.push(inv);
        if (inv && inv.type) {
          typeCounts[inv.type] = (typeCounts[inv.type] || 0) + 1;
        }
      });
    }

    // Count active users (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeUsers = users.filter(u => u.lastSeen > weekAgo).length;

    // Status counts
    let acceptedInvites = 0;
    let declinedInvites = 0;
    let rescheduleInvites = 0;
    if (statusesSnap && statusesSnap.exists()) {
      statusesSnap.forEach(c => {
        const val = c.val();
        if (val === 'accepted') acceptedInvites++;
        else if (val === 'declined') declinedInvites++;
        else if (val === 'reschedule' || val === 'rescheduled') rescheduleInvites++;
      });
    }

    // Roles and ban count
    let founderCount = 0;
    let techAdminCount = 0;
    let moderatorCount = 0;
    let regularUserCount = 0;
    let bannedCount = 0;

    users.forEach(u => {
      if (u.banned) bannedCount++;
      if (u.role === 'founder') founderCount++;
      else if (u.role === 'tech-admin') techAdminCount++;
      else if (u.role === 'moderator') moderatorCount++;
      else regularUserCount++;
    });

    // Reports breakdown
    let pendingReports = 0;
    let resolvedReports = 0;
    let dismissedReports = 0;
    if (reportsSnap && reportsSnap.exists()) {
      reportsSnap.forEach(c => {
        const val = c.val();
        if (val.status === 'pending') pendingReports++;
        else if (val.status === 'resolved') resolvedReports++;
        else if (val.status === 'dismissed') dismissedReports++;
      });
    }

    // Friend connections
    let totalFriendsConnections = 0;
    if (friendsSnap && friendsSnap.exists()) {
      friendsSnap.forEach(userNode => {
        const val = userNode.val();
        if (val) {
          totalFriendsConnections += Object.keys(val).length;
        }
      });
    }
    // Divide by 2 because friendships are bidirectionally saved (A is friend of B, B is friend of A)
    totalFriendsConnections = Math.floor(totalFriendsConnections / 2);

    return {
      totalUsers: users.length,
      totalInvites,
      acceptedInvites,
      declinedInvites,
      rescheduleInvites,
      activeUsers,
      bannedCount,
      roleCounts: {
        founder: founderCount,
        techAdmin: techAdminCount,
        moderator: moderatorCount,
        user: regularUserCount
      },
      reportsCount: {
        pending: pendingReports,
        resolved: resolvedReports,
        dismissed: dismissedReports,
        total: pendingReports + resolvedReports + dismissedReports
      },
      totalFriendsConnections,
      users,
      personalInvitesCount,
      groupInvitesCount,
      typeCounts,
      personalInvites,
      groupInvites,
    };
  }

  // ═══════════════════════════════════════════════════════
  // Real-time listeners
  // ═══════════════════════════════════════════════════════

  function listenStatuses(uid, callback) {
    if (!db()) return;
    db().ref('statuses').on('value', snap => {
      callback(snap.val() || {});
    });
  }

  function listenUserInvites(uid, callback) {
    if (!db()) return;
    db().ref('user-invites/' + uid).on('value', snap => {
      const list = [];
      if (snap.exists()) snap.forEach(c => { list.push(c.val()); });
      callback(list.sort((a, b) => (b.created || 0) - (a.created || 0)));
    });
  }

  function stopListening(path) {
    if (!db()) return;
    db().ref(path).off();
  }

  // ═══════════════════════════════════════════════════════
  // Invite via friend (direct, no link needed)
  // ═══════════════════════════════════════════════════════

  async function sendInviteToFriend(inv, friendUid) {
    if (!db()) return;
    // Save invite
    await createInvite(inv);
    // Send notification
    await ZAP.notifications.addNotification(friendUid, {
      type: 'invite',
      title: 'Нове запрошення',
      body: `${inv.from || 'Хтось'} запрошує вас: ${ZAP.utils.TYPE_MAP[inv.type]?.l || 'Зустріч'}`,
      inviteId: inv.id,
      fromUid: inv.creatorUid,
      fromName: inv.from || '',
    });
  }

  ZAP.db = {
    // Users
    getUserByUid, getUserByLogin, getUserById, getAllUsers, updateUserRole, banUser,
    // Invites
    createInvite, getInvite, getUserInvites, updateInviteStatus, deleteInvite,
    saveReschedule, getReschedule,
    // Group invites
    createGroupInvite, getGroupInvite, joinGroupInvite,
    updateGroupMemberStatus, sendGroupInviteToFriends,
    // Friends
    sendFriendRequest, acceptFriendRequest, declineFriendRequest,
    removeFriend, getFriends, getFriendRequests,
    // Reports
    createReport, getReports, resolveReport,
    // Stats
    getStats,
    // Real-time
    listenStatuses, listenUserInvites, stopListening,
    // Direct invite
    sendInviteToFriend,
  };
})();

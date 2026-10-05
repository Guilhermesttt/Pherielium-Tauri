export interface ReplaceableSenderLike {
    track?: MediaStreamTrack | null;
    replaceTrack: (track: MediaStreamTrack | null) => Promise<unknown> | unknown;
}

export interface PeerConnectionLike {
    getSenders: () => ReplaceableSenderLike[];
}

export interface ReplaceableLocalTrackLike {
    replaceTrack?: (track: MediaStreamTrack) => Promise<unknown> | unknown;
}

export interface LocalTrackPublicationLike {
    track?: ReplaceableLocalTrackLike | null;
}

export interface LocalParticipantLike {
    unpublishTrack: (track: unknown) => Promise<unknown> | unknown;
}

export async function replaceOutgoingAudioTrack(args: {
    peerConnections: Iterable<PeerConnectionLike>;
    livekitPublication?: LocalTrackPublicationLike | null;
    previousTrack?: MediaStreamTrack | null;
    excludedTracks?: Iterable<MediaStreamTrack>;
    newTrack: MediaStreamTrack;
}): Promise<void> {
    const { peerConnections, livekitPublication, previousTrack, newTrack } = args;
    const excludedTracks = new Set(args.excludedTracks || []);

    const p2pTasks: Promise<unknown>[] = [];
    for (const pc of peerConnections) {
        const senders = pc.getSenders();
        const explicitMicSender = previousTrack
            ? senders.find((sender) => sender.track === previousTrack)
            : undefined;
        const fallbackMicSender = senders.find(
            (sender) => sender.track?.kind === "audio" && sender.track && !excludedTracks.has(sender.track),
        );
        const sender = explicitMicSender || fallbackMicSender;
        if (sender) {
            p2pTasks.push(Promise.resolve(sender.replaceTrack(newTrack)));
        }
    }

    const livekitTrack = livekitPublication?.track;
    const livekitTask = livekitTrack?.replaceTrack
        ? Promise.resolve(livekitTrack.replaceTrack(newTrack))
        : Promise.resolve();

    await Promise.all([...p2pTasks, livekitTask]);
}

/** Drops a camera sender without touching a screen-share track on the same peer connection. */
export async function detachCameraTrackFromPeers(args: {
    peerConnections: Iterable<PeerConnectionLike>;
    cameraTracks: Iterable<MediaStreamTrack>;
}): Promise<void> {
    const cameraTracks = new Set(args.cameraTracks);
    if (cameraTracks.size === 0) return;

    const tasks: Promise<unknown>[] = [];
    for (const pc of args.peerConnections) {
        for (const sender of pc.getSenders()) {
            if (sender.track && cameraTracks.has(sender.track)) {
                tasks.push(Promise.resolve(sender.replaceTrack(null)));
            }
        }
    }

    await Promise.all(tasks);
}

export async function replaceOutgoingCameraTrack(args: {
    peerConnections: Iterable<PeerConnectionLike>;
    livekitPublication?: LocalTrackPublicationLike | null;
    previousTrack?: MediaStreamTrack | null;
    screenTracks?: Iterable<MediaStreamTrack>;
    newTrack: MediaStreamTrack;
}): Promise<void> {
    const { peerConnections, livekitPublication, previousTrack, newTrack } = args;
    const screenTracks = new Set(args.screenTracks || []);

    const p2pTasks: Promise<unknown>[] = [];
    for (const pc of peerConnections) {
        const senders = pc.getSenders();
        const explicit = previousTrack
            ? senders.find((sender) => sender.track === previousTrack)
            : undefined;
        const fallback = senders.find(
            (sender) =>
                sender.track?.kind === "video" &&
                sender.track &&
                !screenTracks.has(sender.track),
        );
        const sender = explicit || fallback;
        if (sender) {
            p2pTasks.push(Promise.resolve(sender.replaceTrack(newTrack)));
        }
    }

    const livekitTrack = livekitPublication?.track;
    const livekitTask = livekitTrack?.replaceTrack
        ? Promise.resolve(livekitTrack.replaceTrack(newTrack))
        : Promise.resolve();

    await Promise.all([...p2pTasks, livekitTask]);
}

export interface ScreenPeerLike extends PeerConnectionLike {
    addTrack: (track: MediaStreamTrack, stream: MediaStream) => unknown;
}

/** Publishes screen video and desktop audio on their own senders. Never replaces the camera or microphone. */
export async function attachScreenTracksToPeer(args: {
    peer: ScreenPeerLike;
    stream: MediaStream;
    videoTrack: MediaStreamTrack;
    audioTrack?: MediaStreamTrack | null;
}): Promise<void> {
    const videoSender = args.peer.getSenders().find((sender) => sender.track === args.videoTrack);
    if (videoSender) {
        await videoSender.replaceTrack(args.videoTrack);
    } else {
        args.peer.addTrack(args.videoTrack, args.stream);
    }

    if (!args.audioTrack) return;
    const audioSender = args.peer.getSenders().find((sender) => sender.track === args.audioTrack);
    if (!audioSender) {
        args.peer.addTrack(args.audioTrack, args.stream);
    }
}

export async function detachScreenTracksFromPeers(args: {
    peerConnections: Iterable<PeerConnectionLike>;
    videoTrack?: MediaStreamTrack | null;
    audioTrack?: MediaStreamTrack | null;
}): Promise<void> {
    const { peerConnections, videoTrack, audioTrack } = args;
    const targets = new Set<MediaStreamTrack>();
    if (videoTrack) targets.add(videoTrack);
    if (audioTrack) targets.add(audioTrack);
    if (targets.size === 0) return;

    const tasks: Promise<unknown>[] = [];
    for (const pc of peerConnections) {
        for (const sender of pc.getSenders()) {
            if (sender.track && targets.has(sender.track)) {
                tasks.push(Promise.resolve(sender.replaceTrack(null)));
            }
        }
    }

    await Promise.all(tasks);
}

async function unpublishOne(
    participant: LocalParticipantLike,
    publication?: { track?: unknown | null } | null,
): Promise<void> {
    if (!publication?.track) return;
    await participant.unpublishTrack(publication.track);
}

export async function unpublishScreenPublications(args: {
    participant?: LocalParticipantLike | null;
    videoPublication?: { track?: unknown | null } | null;
    audioPublication?: { track?: unknown | null } | null;
}): Promise<void> {
    const { participant, videoPublication, audioPublication } = args;
    if (!participant) return;

    await Promise.all([
        unpublishOne(participant, videoPublication),
        unpublishOne(participant, audioPublication),
    ]);
}

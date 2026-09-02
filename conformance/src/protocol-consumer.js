// SPDX-License-Identifier: Apache-2.0

export class ProtocolConsumer {
  #state = null;

  consume(message) {
    if (message.type !== "state.snapshot") return;
    if (this.#state && message.revision < this.#state.revision) return;
    this.#state = structuredClone(message.payload.state);
  }

  snapshot() {
    return this.#state ? structuredClone(this.#state) : null;
  }

  canonicalPositionAt(relayTimeMs) {
    if (!this.#state) throw new Error("consumer has not received a state snapshot");
    const playback = this.#state.round.playback;
    if (relayTimeMs < playback.anchorRelayTimeMs) {
      throw new Error("relay time precedes the playback anchor");
    }
    if (playback.mode === "paused") return playback.anchorPositionMs;
    return (
      playback.anchorPositionMs +
      (relayTimeMs - playback.anchorRelayTimeMs) * playback.rate
    );
  }
}

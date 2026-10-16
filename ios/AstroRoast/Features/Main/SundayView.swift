import SwiftUI
import AVFoundation
import AstroKit

@MainActor
final class SpeechController: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    @Published var index = 0
    @Published var playing = false
    @Published var finished = false
    var rate: Float = 1.0 { didSet { if playing { restart() } } }
    private let synth = AVSpeechSynthesizer()
    private var paragraphs: [String] = []
    override init() { super.init(); synth.delegate = self }

    func load(_ p: [String]) { paragraphs = p }
    func toggle() { if playing { pause() } else { play() } }
    func play() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio); try? AVAudioSession.sharedInstance().setActive(true)
        if synth.isPaused { synth.continueSpeaking(); playing = true; return }
        if finished { index = 0; finished = false }
        speak(from: index)
    }
    func pause() { synth.pauseSpeaking(at: .word); playing = false }
    func skip(_ d: Int) { index = max(0, min(paragraphs.count - 1, index + d)); if playing { speak(from: index) } }
    func stop() { synth.stopSpeaking(at: .immediate); playing = false }
    private func restart() { speak(from: index) }
    private func speak(from i: Int) {
        synth.stopSpeaking(at: .immediate)
        index = i; playing = true
        let voice = AVSpeechSynthesisVoice(language: "en-GB") ?? AVSpeechSynthesisVoice(language: "en-US")
        for (k, text) in paragraphs.enumerated() where k >= i {
            let u = AVSpeechUtterance(string: text); u.voice = voice; u.rate = AVSpeechUtteranceDefaultSpeechRate * 0.96 * rate; u.pitchMultiplier = 0.95; u.postUtteranceDelay = 0.35
            synth.speak(u)
        }
    }
    nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, didStart u: AVSpeechUtterance) {
        Task { @MainActor in if let k = self.paragraphs.firstIndex(of: u.speechString) { self.index = k } }
    }
    nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) {
        Task { @MainActor in if self.paragraphs.last == u.speechString { self.playing = false; self.finished = true } }
    }
}

struct SundayView: View {
    @Environment(AppModel.self) private var model
    @StateObject private var speech = SpeechController()
    @State private var week: (title: String, paragraphs: [String], days: [DayReading])?
    @State private var speed = 1.0

    var body: some View {
        PlusGate(title: "The Sunday roast", blurb: "Your week ahead, read aloud in a voice that knows you. Sixty seconds, every Sunday.") {
            ZStack {
                ScreenBackground(glow: true)
                if let w = week {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            VStack(alignment: .leading, spacing: 6) {
                                MonoLabel("Week of \(Date.now.formatted(.dateTime.day().month(.abbreviated))) · \(Int(Double(w.paragraphs.joined(separator: " ").count) / 14.5 / speed))s", size: 10, tracking: 2)
                                HStack(alignment: .firstTextBaseline, spacing: 10) { Text("The week ahead,").font(.display(40, .heavy)).tracking(-1.2).textCase(.uppercase); }.foregroundStyle(Palette.text)
                                Text("ROASTED").font(.display(40, .heavy)).tracking(-1.2).foregroundStyle(Palette.ember)
                            }
                            Waveform(progress: Double(speech.index) / Double(max(w.paragraphs.count - 1, 1)), active: speech.playing).frame(height: 56)
                            HStack(spacing: 34) {
                                Spacer()
                                Button { speech.skip(-1) } label: { Image(systemName: "backward.fill").font(.system(size: 20)).frame(width: 44, height: 44) }.foregroundStyle(Palette.text2).accessibilityLabel("Previous line")
                                Button { speech.toggle() } label: { Image(systemName: speech.playing ? "pause.fill" : "play.fill").font(.system(size: 26)).foregroundStyle(Palette.ink).frame(width: 72, height: 72).background(Palette.moon, in: Circle()) }.accessibilityLabel(speech.playing ? "Pause" : "Play")
                                Button { speed = speed == 1 ? 1.25 : (speed == 1.25 ? 1.5 : 1); speech.rate = Float(speed) } label: { Text(speed == 1 ? "1×" : (speed == 1.25 ? "1.25×" : "1.5×")).font(.mono(13)).frame(width: 44, height: 44) }.foregroundStyle(Palette.text2).accessibilityLabel("Speed")
                                Spacer()
                            }
                            VStack(alignment: .leading, spacing: 12) {
                                MonoLabel("Transcript", size: 10, tracking: 2)
                                ForEach(Array(w.paragraphs.enumerated()), id: \.offset) { i, p in
                                    Text(p).font(.system(size: 16)).lineSpacing(5).foregroundStyle(i == speech.index ? Palette.text : Palette.text3).animation(.easeOut(duration: 0.3), value: speech.index)
                                }
                            }.padding(.vertical, 14).overlay(alignment: .top) { Hairline() }
                            VStack(alignment: .leading, spacing: 10) {
                                MonoLabel("The week in one word a day", size: 10, tracking: 1.8)
                                HStack(alignment: .bottom, spacing: 6) {
                                    ForEach(Array(w.days.enumerated()), id: \.offset) { _, d in
                                        VStack(spacing: 6) {
                                            RoundedRectangle(cornerRadius: 6).fill(d.intensity > 0.6 ? Palette.ember : (d.intensity > 0.35 ? Color(white: 0.55) : Color(white: 0.18))).frame(height: 10 + 46 * d.intensity)
                                            Text(d.vibe).font(.system(size: 10.5)).foregroundStyle(Palette.text2).lineLimit(1).minimumScaleFactor(0.6)
                                            Text(d.day.formatted(.dateTime.weekday(.narrow))).font(.mono(9)).foregroundStyle(Palette.text3)
                                        }.frame(maxWidth: .infinity)
                                    }
                                }.frame(height: 96, alignment: .bottom)
                            }
                        }.padding(.horizontal, 22).padding(.top, 10).padding(.bottom, 30)
                    }.scrollIndicators(.hidden)
                } else { ProgressView().tint(Palette.text2) }
            }.foregroundStyle(Palette.text)
        }
        .navigationTitle("Sunday roast").navigationBarTitleDisplayMode(.inline).toolbarBackground(Palette.ground, for: .navigationBar)
        .task { if let n = model.natal { let w = Voice.weekRoast(natal: n, startingAt: Date()); week = w; speech.load(w.paragraphs) } }
        .onDisappear { speech.stop() }
    }
}

struct Waveform: View {
    let progress: Double; let active: Bool
    var body: some View {
        TimelineView(.animation(minimumInterval: 0.08, paused: !active)) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            HStack(alignment: .center, spacing: 3) {
                ForEach(0..<46, id: \.self) { i in
                    let base = 12 + abs(sin(Double(i) * 1.7) * 26 + sin(Double(i) * 0.45) * 14)
                    let wob = active ? sin(t * 4 + Double(i) * 0.7) * 6 : 0
                    RoundedRectangle(cornerRadius: 2).fill(Double(i) / 46 <= progress ? Palette.moon : Color(white: 0.15)).frame(height: max(6, min(54, base + wob)))
                }
            }
        }.accessibilityHidden(true)
    }
}

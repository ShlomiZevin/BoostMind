#!/bin/bash
# sound for the Syncs teaser v3: music from frame 0 (low under the hook, full from the cut), hook + punchline voices, sfx
cd "$(dirname "$0")"
P=..; S=C:/workspace/BoostMind/zoomcut/episodes/_assets/shlomiverse/source; L=C:/workspace/BoostMind/zoomcut/library/sounds
END=27.6
# file|start-in-video|volume|trim-in|trim-len
SFX=(
"$L/pop1.mp3|2.75|0.45|0|0.5"
"$L/pop-2.mp3|3.75|0.35|0|0.5"
"$L/tick.mp3|4.75|0.40|0|0.6"
"$L/pop3.mp3|5.75|0.30|0|0.5"
"$L/click.mp3|8.72|0.55|0|0.5"
"$L/pop2.mp3|9.25|0.30|0|0.5"
"$L/pop-1.mp3|10.75|0.30|0|0.5"
"$L/click-34b245.mp3|12.72|0.45|0|0.6"
"$L/tick.mp3|15.22|0.40|0|0.6"
"$L/pop1.mp3|15.75|0.28|0|0.5"
"$L/pop3.mp3|17.25|0.30|0|0.5"
"$L/pop-2.mp3|19.75|0.32|0|0.5"
"$S/sfx-whoosh.wav|23.00|0.55|0|0.9"
"$S/px-kick-hit.mp3|23.75|0.70|0|1.75"
"$S/sfx-ting.mp3|23.75|0.45|0|2.4"
"$S/sfx-shimmer.mp3|23.80|0.30|0|2.4"
)
args=(-i $P/music/corp.mp3 -i $P/src/ronit-joins.wav -i $P/src/follow-up.wav)
fc="[1:a]atrim=6.25,asetpts=PTS-STARTPTS,volume='if(lt(t,2.70),0.22,1)':eval=frame,aformat=sample_rates=48000:channel_layouts=stereo[mus];"
fc+="[2:a]atrim=35.80:38.55,asetpts=PTS-STARTPTS,afade=t=out:st=2.70:d=0.05,volume=1.5,aformat=sample_rates=48000:channel_layouts=stereo[hook];"
fc+="[3:a]atrim=101.50:103.45,asetpts=PTS-STARTPTS,afade=t=out:st=1.88:d=0.07,volume=1.5,adelay=25150|25150,aformat=sample_rates=48000:channel_layouts=stereo[amir];"
mixin="[mus][hook][amir]"; i=4; k=0
for s in "${SFX[@]}"; do
  IFS='|' read f t v a n <<< "$s"; args+=(-i "$f"); ms=$(python -c "print(int($t*1000))")
  fc+="[$i:a]atrim=$a:$(python -c "print($a+$n)"),asetpts=PTS-STARTPTS,volume=$v,adelay=$ms|$ms,aformat=sample_rates=48000:channel_layouts=stereo[s$k];"
  mixin+="[s$k]"; i=$((i+1)); k=$((k+1))
done
n=$((3+k))
fc+="${mixin}amix=inputs=$n:normalize=0:duration=longest,atrim=0:$END,alimiter=limit=0.89,apad=whole_dur=$END[a]"
ffmpeg -v error -y -i video.mp4 "${args[@]}" -filter_complex "$fc" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart syncs-teaser.mp4 \
  || { echo FAIL; exit 1; }
echo ok

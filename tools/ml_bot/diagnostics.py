"""Read-only schema-v5 rollout audits and self-contained training dashboard."""

from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any, Mapping

import numpy as np

from .checkpoint import atomic_write
from .metrics import read_jsonl
from .spec import POLICY_SPEC


def write_observation_audit(path: Path, observations: np.ndarray) -> None:
    values = np.asarray(observations, dtype=np.float64).reshape(
        -1, POLICY_SPEC.observation_size
    )
    finite = np.isfinite(values)
    report = {
        "audit_version": 5,
        "rows": values.shape[0],
        "nonfinite_total": int(np.size(finite) - np.count_nonzero(finite)),
        "features": [
            {
                "name": name,
                "minimum": finite_stat(values[:, index], np.min),
                "maximum": finite_stat(values[:, index], np.max),
                "mean": finite_stat(values[:, index], np.mean),
                "standard_deviation": finite_stat(values[:, index], np.std),
                "nonfinite_count": int(np.count_nonzero(~finite[:, index])),
                "constant_fraction": constant_fraction(values[:, index]),
            }
            for index, name in enumerate(POLICY_SPEC.observation_names)
        ],
    }
    atomic_write(
        path,
        (json.dumps(report, allow_nan=False, separators=(",", ":"), sort_keys=True) + "\n").encode(),
    )


def write_value_calibration(
    path: Path,
    predicted: np.ndarray,
    realized: np.ndarray,
) -> None:
    predicted = np.asarray(predicted, dtype=np.float64).reshape(-1)
    realized = np.asarray(realized, dtype=np.float64).reshape(-1)
    if predicted.shape != realized.shape or not np.all(np.isfinite(predicted)) or not np.all(
        np.isfinite(realized)
    ):
        raise ValueError("value calibration arrays must be equal and finite")
    payload = {
        "calibration_version": 5,
        "count": int(predicted.size),
        "mean_error": float(np.mean(predicted - realized)),
        "root_mean_square_error": float(np.sqrt(np.mean((predicted - realized) ** 2))),
        "predicted": predicted.tolist(),
        "realized": realized.tolist(),
    }
    atomic_write(
        path,
        (json.dumps(payload, allow_nan=False, separators=(",", ":"), sort_keys=True) + "\n").encode(),
    )


def render_dashboard(training_directory: Path, output: Path) -> Mapping[str, Any]:
    metrics = read_jsonl(training_directory / "metrics.jsonl")
    episodes = read_jsonl(training_directory / "episodes.jsonl")
    payload = json.dumps(
        {"metrics": metrics, "episodes": episodes},
        allow_nan=False,
        separators=(",", ":"),
    ).replace("</", "<\\/")
    document = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Solomon Dark ML policy v5 diagnostics</title>
<style>
body{{margin:0;background:#11151b;color:#e8edf2;font:14px system-ui,sans-serif}}main{{max-width:1200px;margin:auto;padding:24px}}
h1,h2{{font-weight:600}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px}}
section{{background:#1a2029;border:1px solid #303946;border-radius:8px;padding:16px}}canvas{{width:100%;height:220px;background:#0d1117}}
table{{width:100%;border-collapse:collapse}}th,td{{padding:6px;text-align:right;border-bottom:1px solid #303946}}th:first-child,td:first-child{{text-align:left}}
</style></head><body><main><h1>ML policy v5 diagnostics</h1><p id="summary"></p><div class="grid">
<section><h2>Return and wave depth</h2><canvas id="returns" width="720" height="300"></canvas></section>
<section><h2>Losses and KL</h2><canvas id="losses" width="720" height="300"></canvas></section>
<section><h2>Per-head entropy</h2><canvas id="entropy" width="720" height="300"></canvas></section>
<section><h2>SMDP watchlist</h2><canvas id="smdp" width="720" height="300"></canvas></section>
<section><h2>Reward decomposition</h2><table id="rewards"></table></section>
<section><h2>Action totals</h2><table id="actions"></table></section>
</div></main><script id="data" type="application/json">{payload}</script><script>
const data=JSON.parse(document.getElementById('data').textContent);const M=data.metrics,E=data.episodes;
document.getElementById('summary').textContent=`${{M.length}} updates · ${{E.length}} episode records`;
const colors=['#5eead4','#fbbf24','#fb7185','#93c5fd','#c4b5fd'];
function plot(id,series){{const c=document.getElementById(id),x=c.getContext('2d'),w=c.width,h=c.height;x.clearRect(0,0,w,h);let all=series.flatMap(s=>s.v).filter(Number.isFinite);if(!all.length)return;let lo=Math.min(...all),hi=Math.max(...all);if(lo===hi){{lo-=1;hi+=1}}x.strokeStyle='#334155';x.strokeRect(36,12,w-48,h-36);series.forEach((s,j)=>{{x.strokeStyle=colors[j%colors.length];x.beginPath();s.v.forEach((v,i)=>{{let px=36+i*(w-48)/Math.max(1,s.v.length-1),py=12+(hi-v)*(h-36)/(hi-lo);i?x.lineTo(px,py):x.moveTo(px,py)}});x.stroke();x.fillStyle=x.strokeStyle;x.fillText(s.n,44,28+j*15)}})}}
plot('returns',[{{n:'return',v:M.map(x=>x.return_mean)}},{{n:'wave',v:M.map(x=>x.wave_depth_mean)}}]);
plot('losses',[{{n:'policy',v:M.map(x=>x.policy_loss)}},{{n:'value',v:M.map(x=>x.value_loss)}},{{n:'KL',v:M.map(x=>x.kl_divergence)}}]);
plot('entropy',[{{n:'move',v:M.map(x=>x.entropy_move)}},{{n:'target',v:M.map(x=>x.entropy_target)}},{{n:'ability',v:M.map(x=>x.entropy_ability)}},{{n:'aim',v:M.map(x=>x.entropy_aim)}}]);
plot('smdp',[{{n:'policy',v:M.map(x=>x.smdp.policy_loss)}},{{n:'value',v:M.map(x=>x.smdp.value_loss)}},{{n:'entropy',v:M.map(x=>x.smdp.entropy_normalized)}}]);
function table(id,rows){{document.getElementById(id).innerHTML='<tr><th>Metric</th><th>Total</th></tr>'+rows.map(([n,v])=>`<tr><td>${{n}}</td><td>${{v}}</td></tr>`).join('')}}
const reward={{}};E.forEach(e=>Object.entries(e.reward_terms||{{}}).forEach(([k,v])=>reward[k]=(reward[k]||0)+v));table('rewards',Object.entries(reward));
const action={{move:0,target:0,ability:0,aim:0}};E.forEach(e=>Object.entries(e.action_histograms||{{}}).forEach(([k,v])=>action[k]=(action[k]||0)+v.reduce((a,b)=>a+b,0)));table('actions',Object.entries(action));
</script></body></html>"""
    atomic_write(output, document.encode("utf-8"))
    return {
        "status": "ok",
        "metrics": len(metrics),
        "episodes": len(episodes),
        "output": str(output),
    }


def finite_stat(values: np.ndarray, function: Any) -> float | None:
    finite = values[np.isfinite(values)]
    return None if finite.size == 0 else float(function(finite))


def constant_fraction(values: np.ndarray) -> float:
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        return 1.0
    _, counts = np.unique(finite, return_counts=True)
    return float(np.max(counts) / finite.size)

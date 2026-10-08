"""Compare fixed-input export replay; not an accuracy or full acceptance metric."""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("reference", type=Path)
    parser.add_argument("candidate", type=Path)
    args = parser.parse_args()
    reference = json.loads(args.reference.read_text(encoding="utf-8"))
    candidate = json.loads(args.candidate.read_text(encoding="utf-8"))
    if reference['samples'] != candidate['samples'] or reference['input'] != candidate['input']:
        raise ValueError('Reports must use identical samples and input size')
    mismatches = []
    max_score_delta = max_coordinate_delta = 0.0
    matched = 0
    for original, exported in zip(reference['records'], candidate['records']):
        if original['image'] != exported['image']:
            raise ValueError('Replay sample order differs')
        for key in original['models']:
            a = original['models'][key]['boxes']
            b = exported['models'][key]['boxes']
            if len(a) != len(b):
                mismatches.append({'image':original['image'], 'model':key, 'reason':'count'})
                continue
            for first, second in zip(a, b):
                if first['class'] != second['class']:
                    mismatches.append({'image':original['image'], 'model':key, 'reason':'class/order'})
                    continue
                matched += 1
                max_score_delta = max(max_score_delta, abs(first['score'] - second['score']))
                max_coordinate_delta = max(max_coordinate_delta,
                    max(abs(x-y) for x,y in zip(first['xyxy'],second['xyxy'])))
    report = {'samples':candidate['samples'], 'matched_boxes':matched,
              'mismatches':mismatches, 'max_score_delta':max_score_delta,
              'max_xyxy_pixel_delta':max_coordinate_delta}
    print(json.dumps(report, indent=2))
    if mismatches or max_score_delta > 0.001 or max_coordinate_delta > 1:
        raise SystemExit(2)


if __name__ == '__main__':
    main()

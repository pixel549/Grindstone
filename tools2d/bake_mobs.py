"""Bakes the delve's monsters and dungeon props into assets/2d/delve.png + delve.json.

Run:  python3 -I tools2d/bake_mobs.py   (LPC=/path/to/Universal-LPC-Spritesheet-Character-Generator)

Monsters are Universal LPC bodies and heads (skeletons, zombies, trolls, orcs, lizardfolk, boarmen, minotaurs,
wolfmen, robed casters, knights) flattened here, recoloured with the generator's palettes, facing left (they always
face the hero): walk, idle, hurt and one attack, the attack in the weapon's own bigger frames where it has them.
The small beasts (rats, leeches, wisps, crabs, kites) and the props are drawn by hand below. The app tints per theme.
"""
import json, os, sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bake_hero as BH  # noqa: E402

DEFS, SHEETS, FOLDER = BH.DEFS, BH.SHEETS, BH.FOLDER
PAL, BASES = BH.palettes()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', '2d')
LEFT = 1  # LPC rows: up, left, down, right
NFR = {'walk': 9, 'idle': 2, 'slash': 6, 'thrust': 8, 'spellcast': 7, 'hurt': 6}

hexrgb = lambda h: tuple(int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))


def cmap(material, target, base=None):
    pal = PAL.get(material)
    base = base or BASES.get(material)
    if base and '.' in base:
        base = base.split('.')[-1]
    if not pal or not target or target not in pal or base not in pal or target == base:
        return None
    dst = [hexrgb(c) for c in pal[target][0]]
    m = {}
    for ramp in pal[base]:
        src = [hexrgb(c) for c in ramp]
        for i, c in enumerate(src):
            if c not in m:
                m[c] = dst[i if len(dst) == len(src) else min(len(dst) - 1, round(i * (len(dst) - 1) / max(1, len(src) - 1)))]
    return m


def recolour(im, m):
    if not m:
        return im
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in m:
                px[x, y] = m[(r, g, b)] + (a,)
    return im


CACHE = {}


def load(path, m=None):
    key = (path, tuple(sorted(m.items())) if m else None)
    if key not in CACHE:
        im = Image.open(os.path.join(SHEETS, path)).convert('RGBA')
        CACHE[key] = recolour(im.copy(), m)
    return CACHE[key]


def layers_for(part, body, anim):
    """[(z, image)] for one part in one animation (normal 64px frames)."""
    dpath, val = part
    d = json.load(open(os.path.join(DEFS, dpath)))
    rec = d.get('recolors')
    out = []
    for k in sorted(k for k in d if k.startswith('layer_')):
        L = d[k]
        if L.get('custom_animation'):
            continue
        base = L.get(body) or L.get('male')
        if not base:
            continue
        folder = FOLDER.get(anim, anim)
        if rec:
            src = base + folder + '.png'
            r1 = rec if rec.get('material') else next((v for v in rec.values() if isinstance(v, dict) and v.get('material')), {})
            m = cmap(r1.get('material'), val, r1.get('base')) if val and r1 else None
        else:
            v = val or (d.get('variants') or [None])[0]
            if not v:
                continue
            src = base + folder + '/' + v.replace(' ', '_') + '.png'
            m = None
        if os.path.exists(os.path.join(SHEETS, src)):
            out.append((L['zPos'], load(src, m)))
    return out


def custom_for(part, body, ca):
    dpath, val = part
    d = json.load(open(os.path.join(DEFS, dpath)))
    out = []
    for k in sorted(k for k in d if k.startswith('layer_')):
        L = d[k]
        if L.get('custom_animation') != ca:
            continue
        base = L.get(body) or L.get('male')
        v = (val or (d.get('variants') or [''])[0]).replace(' ', '_')
        for src in (base + v + '.png',):
            if os.path.exists(os.path.join(SHEETS, src)):
                out.append((L['zPos'], load(src)))
    return out


def row_strip(parts, body, anim, row):
    """One row of one animation, all parts composited: an image n*64 wide, 64 tall."""
    n = NFR[anim]
    out = Image.new('RGBA', (n * 64, 64))
    if anim == 'idle' and any(layers_for(p, body, 'walk') and not layers_for(p, body, 'idle') for p in parts):
        # some bodies (the zombies) have no idle frames: stand still on the first walk frame instead,
        # all parts together so the head stays on the shoulders
        w = row_strip(parts, body, 'walk', row).crop((0, 0, 64, 64))
        for i in range(n):
            out.alpha_composite(w, (i * 64, 0))
        return out
    lays = []
    for p in parts:
        lays += layers_for(p, body, anim)
    for z, im in sorted(lays, key=lambda t: t[0]):
        rows = im.height // 64
        r = 0 if rows == 1 else row
        out.alpha_composite(im.crop((0, r * 64, min(im.width, n * 64), r * 64 + 64)), (0, 0))
    return out


def attack_strip(parts, body, anim, weapon, ca):
    """The attack row: in the weapon's own frame size if it swings big, else 64."""
    if not ca:
        return row_strip(parts + ([weapon] if weapon else []), body, anim, LEFT), 64
    size = {'slash_128': 128, 'slash_oversize': 192, 'thrust_oversize': 192}[ca]
    n = NFR[anim] if anim != 'thrust' else 8
    if ca == 'slash_128' or ca == 'slash_oversize':
        n = 6
    off = (size - 64) // 2
    body_lays = []
    for p in parts:
        body_lays += [(z, im, False) for z, im in layers_for(p, body, anim)]
    w_lays = [(z, im, True) for z, im in custom_for(weapon, body, ca)]
    out = Image.new('RGBA', (n * size, size))
    for i in range(n):
        for z, im, big in sorted(body_lays + w_lays, key=lambda t: t[0]):
            if big:
                fr = im.crop((i * size, LEFT * size, i * size + size, LEFT * size + size))
                out.alpha_composite(fr, (i * size, 0))
            else:
                rows = im.height // 64
                r = 0 if rows == 1 else LEFT
                if (i + 1) * 64 > im.width:
                    continue
                fr = im.crop((i * 64, r * 64, i * 64 + 64, r * 64 + 64))
                out.alpha_composite(fr, (i * size + off, off))
    return out, size


H = 'head/heads/'
BODY, SKEL, ZOMB, WINGS = 'body/body.json', 'body/special/body_skeleton.json', 'body/special/body_zombie.json', 'body/wings/wings_bat.json'
I = {k: v[0] for k, v in BH.ITEMS.items()}
MOBS = {
    # name: (body type, parts, attack anim, weapon part or None, weapon custom anim or None)
    'skel': ('male', [(SKEL, None), (H + 'undead/heads_skeleton.json', None)], 'slash', (I['w_arming'], 'iron'), 'slash_128'),
    'skelknight': ('male', [(SKEL, None), (H + 'undead/heads_skeleton.json', None), (I['plate'], None), (I['legs_armour'], None), (I['greathelm'], None), (I['s_heater'], None)], 'slash', (I['w_arming'], 'steel'), 'slash_128'),
    'skelpirate': ('male', [(SKEL, None), (H + 'undead/heads_skeleton.json', None), (I['frock'], 'navy'), (I['tricorne'], 'black')], 'slash', (I['w_saber'], None), 'slash_oversize'),
    'zombie': ('male', [(ZOMB, 'zombie'), (H + 'undead/heads_zombie.json', None)], 'slash', None, None),
    'zsailor': ('male', [(ZOMB, 'zombie'), (H + 'undead/heads_zombie.json', None), (I['shirt_l'], 'teal'), (I['pants'], 'navy')], 'slash', None, None),
    'zpenitent': ('male', [(ZOMB, 'zombie'), (H + 'undead/heads_zombie.json', None), (I['robe'], 'brown'), (I['hood'], 'gray')], 'slash', None, None),
    'zking': ('male', [(ZOMB, 'zombie'), (H + 'undead/heads_zombie.json', None), (I['tabard'], 'maroon'), (I['crown'], 'crown_gold')], 'slash', None, None),
    'troll': ('muscular', [(BODY, 'blue'), (H + 'fantasy/heads_troll.json', 'blue'), (I['pants'], 'brown')], 'slash', None, None),
    'lizard': ('male', [(BODY, 'green'), (H + 'reptile/heads_lizard_male.json', 'green'), (I['leather'], None), (I['pants'], 'brown')], 'thrust', (I['w_spear'], 'dark'), None),
    'boar': ('muscular', [(BODY, 'fur_brown'), (H + 'beast/heads_boarman.json', 'fur_brown'), (I['pants'], 'forest')], 'slash', None, None),
    'minotaur': ('muscular', [(BODY, 'fur_brown'), (H + 'beast/heads_minotaur.json', 'fur_brown'), (I['legs_armour'], None), (I['pauldrons'], None)], 'slash', (I['w_waraxe'], None), 'slash_oversize'),
    'hag': ('female', [(BODY, 'pale_green'), (H + 'human/heads_human_female_elderly.json', 'pale_green'), (I['robe'], 'forest green'), (I['hood'], 'black')], 'spellcast', None, None),
    'witch': ('female', [(BODY, 'blue'), (H + 'human/heads_human_female.json', 'blue'), (I['robe'], 'blue')], 'spellcast', None, None),
    'acolyte': ('female', [(BODY, 'light'), (H + 'human/heads_human_female.json', 'light'), (I['robe'], 'red'), (I['hood'], 'maroon')], 'spellcast', None, None),
    'adept': ('female', [(BODY, 'taupe'), (H + 'human/heads_human_female.json', 'taupe'), (I['robe'], 'blue'), (I['hood'], 'navy')], 'spellcast', None, None),
    'knight': ('male', [(BODY, 'light'), (H + 'human/heads_human_male.json', 'light'), (I['plate'], None), (I['arms_armour'], None), (I['legs_armour'], None), (I['feet_armour'], None), (I['armet'], None), (I['s_heater'], None)], 'slash', (I['w_longsword'], None), 'slash_oversize'),
    'templarking': ('male', [(BODY, 'light'), (H + 'human/heads_human_male.json', 'light'), (I['plate'], None), (I['arms_armour'], None), (I['legs_armour'], None), (I['feet_armour'], None), (I['crown'], 'crown_gold'), (I['cape'], 'yellow')], 'slash', (I['w_longsword'], None), 'slash_oversize'),
    'archon': ('female', [(BODY, 'lavender'), (H + 'human/heads_human_female.json', 'lavender'), (I['robe'], 'purple'), (I['crown'], 'crown_blue')], 'spellcast', None, None),
    'imp': ('male', [(BODY, 'bright_green'), (H + 'fantasy/heads_goblin.json', 'bright_green'), (WINGS, None)], 'slash', None, None),
    'gargoyle': ('muscular', [(BODY, 'black'), (H + 'fantasy/heads_troll.json', 'black'), (WINGS, None)], 'slash', None, None),
    'harpy': ('female', [(BODY, 'light'), (H + 'human/heads_human_female.json', 'light'), (I['hair_long'], None), (I['robe'], 'dark brown'), (WINGS, None)], 'slash', None, None),
    'wolfman': ('male', [(BODY, 'fur_grey'), (H + 'beast/heads_wolf_male.json', 'fur_grey'), (I['pants'], 'charcoal')], 'slash', None, None),
}
# 2.22: many more of them, humans and beast-folk among them, for the new dungeons and a boss per lap.
HM, HF = H + 'human/heads_human_male.json', H + 'human/heads_human_female.json'
# the robe is drawn for women only: on men a long shirt over a plain skirt reads as one
I.update({'lsleeve': 'torso/shirts/longsleeve/torso_clothes_longsleeve.json', 'skirt': 'legs/skirts/legs_skirts_plain.json',
          'cav': 'headwear/hats/caps/hat_cap_cavalier.json', 'apron': 'torso/aprons/torso_aprons_apron.json', 'tatters': 'torso/cape/cape_tattered.json'})
def hum(body, skin, head, *parts):
    return [(BODY, skin), (head, skin)] + [(I[k], v) for k, v in parts]
MOBS.update({
    # the Brigands' Hold
    'bandit': ('male', hum('male', 'tan', HM, ('leather', 'brown'), ('pants', 'charcoal'), ('hood', 'charcoal'), ('mask', 'black')), 'slash', (I['w_dagger'], 'dagger'), None),
    'cutthroat': ('female', hum('female', 'peach', HF, ('leather', 'maroon'), ('pants', 'black'), ('hair_ponytail', 'black')), 'slash', (I['w_saber'], None), 'slash_oversize'),
    'thug': ('male', hum('male', 'brown', H + 'human/heads_human_male_plump.json', ('shirt_s', 'gray'), ('pants', 'brown'), ('belt', 'leather'), ('beard_bushy', 'black')), 'slash', (I['w_mace'], None), 'slash_oversize'),
    'mercenary': ('male', hum('male', 'olive', HM, ('mail', 'iron'), ('kettle', 'iron'), ('pants', 'walnut')), 'thrust', (I['w_halberd'], None), 'thrust_oversize'),
    'brigandking': ('male', hum('male', 'light', HM, ('plate', 'brass'), ('cape', 'red'), ('crown', 'crown_gold'), ('beard_bushy', 'black')), 'slash', (I['w_waraxe'], None), 'slash_oversize'),
    'redmeg': ('female', hum('female', 'peach', HF, ('frock', 'red'), ('tricorne', 'black'), ('eyepatch', 'black'), ('hair_long', 'red')), 'slash', (I['w_rapier'], None), 'slash_oversize'),
    'fence': ('male', hum('male', 'taupe', H + 'human/heads_human_male_gaunt.json', ('trench', 'dark gray'), ('cav', 'black'), ('cavalier', 'black')), 'slash', (I['w_dagger'], 'dagger'), None),
    # the Witchwood
    'hexer': ('female', hum('female', 'light', HF, ('robe', 'black'), ('hood', 'purple')), 'spellcast', None, None),
    'wolfwife': ('female', [(BODY, 'fur_grey'), (H + 'beast/heads_wolf_female.json', 'fur_grey'), (I['robe'], 'dark brown')], 'slash', None, None),
    'harefolk': ('male', [(BODY, 'fur_tan'), (H + 'farm/heads_rabbit.json', 'fur_tan'), (I['leather'], 'forest'), (I['pants'], 'brown')], 'thrust', (I['w_spear'], 'light'), None),
    'woodwose': ('muscular', [(BODY, 'dark_green'), (H + 'fantasy/heads_troll.json', 'dark_green'), (I['pants'], 'forest')], 'slash', None, None),
    'witchmother': ('female', hum('female', 'pale_green', H + 'human/heads_human_female_elderly.json', ('robe', 'purple'), ('tiara', 'tiara_purple'), ('hair_long', 'white')), 'spellcast', None, None),
    'antlered': ('female', [(BODY, 'fur_brown'), (H + 'beast/heads_minotaur_female.json', 'fur_brown'), (I['robe'], 'forest green'), (I['cape'], 'forest')], 'slash', (I['w_mace'], None), 'slash_oversize'),
    'erlking': ('male', hum('male', 'lavender', HM, ('lsleeve', 'forest'), ('skirt', 'forest'), ('cape', 'green'), ('crown', 'forest')), 'thrust', (I['w_gnarled'], 'dark'), 'thrust_oversize'),
    # the Black Keep
    'manatarms': ('male', hum('male', 'light', HM, ('mail', 'steel'), ('nasal', 'steel'), ('tabard', 'black'), ('pants', 'charcoal')), 'thrust', (I['w_halberd'], None), 'thrust_oversize'),
    'blackknight': ('male', hum('male', 'light', HM, ('plate', 'iron'), ('arms_armour', None), ('legs_armour', None), ('armet', 'iron'), ('tabard', 'black'), ('s_heater', None)), 'slash', (I['w_longsword'], None), 'slash_oversize'),
    'squire': ('male', hum('male', 'peach', H + 'human/heads_human_male_small.json', ('shirt_s', 'slate'), ('pants', 'brown'), ('hair_cropped', 'light_brown')), 'slash', (I['w_dagger'], 'dagger'), None),
    'chaplain': ('male', hum('male', 'light', H + 'human/heads_human_male_elderly.json', ('lsleeve', 'white'), ('skirt', 'white'), ('tabard', 'black')), 'spellcast', None, None),
    'castellan': ('male', hum('male', 'light', HM, ('plate', 'steel'), ('arms_armour', None), ('legs_armour', None), ('greathelm', 'steel'), ('cape', 'black')), 'slash', (I['w_longsword'], None), 'slash_oversize'),
    'executioner': ('muscular', hum('muscular', 'tan', HM, ('pants', 'black'), ('mask', 'black'), ('belt', 'leather')), 'slash', (I['w_waraxe'], None), 'slash_oversize'),
    'blackprince': ('male', hum('male', 'porcelain', HM, ('plate', 'gold'), ('cape', 'maroon'), ('crown', 'black'), ('hair_long', 'black')), 'slash', (I['w_saber'], None), 'slash_oversize'),
    # the Plague Ward
    'plaguedoctor': ('male', hum('male', 'light', HM, ('lsleeve', 'black'), ('skirt', 'black'), ('cape', 'black'), ('mask', 'white'), ('cav', 'black')), 'spellcast', None, None),
    'ratman': ('male', [(BODY, 'fur_grey'), (H + 'farm/heads_rat.json', 'fur_grey'), (I['shirt_s'], 'brown'), (I['pants'], 'charcoal')], 'slash', (I['w_dagger'], 'dagger'), None),
    'pigman': ('muscular', [(BODY, 'peach'), (H + 'farm/heads_pig.json', 'peach'), (I['pants'], 'brown'), (I['belt'], 'leather')], 'slash', (I['w_mace'], None), 'slash_oversize'),
    'bloat': ('male', [(ZOMB, 'zombie'), (H + 'undead/heads_zombie.json', 'zombie'), (I['apron'], 'white')], 'slash', None, None),
    'orderly': ('male', hum('male', 'ivory', H + 'human/heads_human_male_gaunt.json', ('shirt_l', 'white'), ('pants', 'white')), 'slash', (I['w_dagger'], 'dagger'), None),
    'thedoctor': ('male', hum('male', 'ivory', H + 'human/heads_human_male_gaunt.json', ('trench', 'gray'), ('mask', 'white'), ('cav', 'black'), ('cavalier', 'white')), 'slash', (I['w_rapier'], None), 'slash_oversize'),
    'ratking': ('male', [(BODY, 'fur_black'), (H + 'farm/heads_rat.json', 'fur_black'), (I['robe'], 'purple'), (I['crown'], 'crown_gold'), (I['cape'], 'purple')], 'slash', (I['w_dagger'], 'dagger'), None),
    'abbot': ('male', hum('male', 'pale_green', H + 'human/heads_human_male_plump.json', ('lsleeve', 'brown'), ('skirt', 'brown'), ('belt', 'leather'), ('crown', 'crown_gray')), 'spellcast', None, None),
    # the Moonlit Manor
    'thrall': ('male', [(ZOMB, 'zombie'), (H + 'undead/heads_zombie.json', 'zombie'), (I['shirt_l'], 'white'), (I['pants'], 'black')], 'slash', None, None),
    'vampspawn': ('male', [(BODY, 'porcelain'), (H + 'undead/heads_vampire.json', 'porcelain'), (I['frock'], 'black'), (I['pants'], 'black')], 'slash', None, None),
    'creature': ('muscular', [(BODY, 'green'), (H + 'undead/heads_frankenstein.json', 'green'), (I['pants'], 'charcoal'), (I['shirt_s'], 'gray')], 'slash', None, None),
    'jack': ('male', [(BODY, 'dark_green'), (H + 'undead/heads_jack.json', None), (I['lsleeve'], 'charcoal'), (I['skirt'], 'charcoal'), (I['tatters'], 'black')], 'slash', (I['w_scythe'], None), 'slash_oversize'),
    'count': ('male', [(BODY, 'porcelain'), (H + 'undead/heads_vampire.json', 'porcelain'), (I['frock'], 'black'), (I['cape'], 'red'), (I['crown'], 'black')], 'slash', (I['w_rapier'], None), 'slash_oversize'),
    'ladyred': ('female', [(BODY, 'porcelain'), (H + 'undead/heads_vampire.json', 'porcelain'), (I['robe'], 'red'), (I['tiara'], 'tiara_gold'), (I['hair_long'], 'raven')], 'spellcast', None, None),
    'creaturebig': ('muscular', [(BODY, 'zombie_green'), (H + 'undead/heads_frankenstein.json', 'zombie_green'), (I['pants'], 'black'), (I['pauldrons'], 'charcoal')], 'slash', (I['w_mace'], None), 'slash_oversize'),
    # the Orc Warrens
    'orc': ('male', [(BODY, 'green'), (H + 'fantasy/heads_orc_male.json', 'green'), (I['leather'], 'brown'), (I['pants'], 'brown')], 'slash', (I['w_waraxe'], None), 'slash_oversize'),
    'orcshe': ('female', [(BODY, 'green'), (H + 'fantasy/heads_orc_female.json', 'green'), (I['leather'], 'leather'), (I['pants'], 'charcoal')], 'thrust', (I['w_spear'], 'dark'), None),
    'goblin': ('male', [(BODY, 'bright_green'), (H + 'fantasy/heads_goblin.json', 'bright_green'), (I['shirt_s'], 'brown'), (I['pants'], 'tan')], 'slash', (I['w_dagger'], 'dagger'), None),
    'wartotaur': ('muscular', [(BODY, 'fur_black'), (H + 'beast/heads_wartotaur.json', 'fur_black'), (I['pauldrons'], 'brown'), (I['pants'], 'brown')], 'slash', (I['w_mace'], None), 'slash_oversize'),
    'orcshaman': ('male', [(BODY, 'olive'), (H + 'fantasy/heads_orc_male.json', 'olive'), (I['lsleeve'], 'walnut'), (I['skirt'], 'walnut'), (I['hood'], 'maroon')], 'spellcast', None, None),
    'warchief': ('male', [(BODY, 'dark_green'), (H + 'fantasy/heads_orc_male.json', 'dark_green'), (I['plate'], 'iron'), (I['legion'], 'bronze'), (I['cape'], 'maroon')], 'slash', (I['w_waraxe'], None), 'slash_oversize'),
    'goblinking': ('male', [(BODY, 'bright_green'), (H + 'fantasy/heads_goblin.json', 'bright_green'), (I['robe'], 'purple'), (I['crown'], 'crown_gold'), (I['cape'], 'purple')], 'slash', (I['w_dagger'], 'dagger'), None),
    'wartolord': ('muscular', [(BODY, 'fur_brown'), (H + 'beast/heads_wartotaur.json', 'fur_brown'), (I['plate'], 'bronze'), (I['crown'], 'crown_red')], 'thrust', (I['w_halberd'], None), 'thrust_oversize'),
    # more bosses for the first seven
    'boneabbot': ('male', [(SKEL, None), (H + 'undead/heads_skeleton.json', None), (I['tatters'], 'black'), (I['crown'], 'crown_gray')], 'spellcast', None, None),
    'gravedigger': ('male', hum('male', 'ivory', H + 'human/heads_human_male_gaunt.json', ('shirt_l', 'brown'), ('pants', 'charcoal'), ('hood', 'brown')), 'slash', (I['w_scythe'], None), 'slash_oversize'),
    'winterwitch': ('female', hum('female', 'porcelain', HF, ('robe', 'white'), ('tiara', 'tiara_silver'), ('hair_long', 'platinum')), 'spellcast', None, None),
    'whitewolf': ('female', [(BODY, 'fur_white'), (H + 'beast/heads_wolf_female.json', 'fur_white'), (I['cape'], 'white')], 'slash', None, None),
    'lizardking': ('male', [(BODY, 'green'), (H + 'reptile/heads_lizard_male.json', 'green'), (I['robe'], 'forest green'), (I['crown'], 'crown_gold')], 'thrust', (I['w_spear'], 'dark'), None),
    'forgemaster': ('male', hum('male', 'brown', H + 'human/heads_human_male_plump.json', ('leather', 'black'), ('pants', 'black'), ('beard_bushy', 'ginger')), 'slash', (I['w_mace'], None), 'slash_oversize'),
    'admiral': ('male', [(ZOMB, 'zombie'), (H + 'undead/heads_zombie.json', 'zombie'), (I['frock'], 'navy'), (I['tricorne'], 'navy')], 'slash', (I['w_saber'], None), 'slash_oversize'),
    'paleabbess': ('female', hum('female', 'porcelain', HF, ('robe', 'white'), ('tiara', 'tiara_gold'), ('hood', 'white')), 'spellcast', None, None),
    'inquisitor': ('male', hum('male', 'light', HM, ('trench', 'gray'), ('cav', 'black'), ('cavalier', 'red'), ('beard_trimmed', 'gray')), 'slash', (I['w_rapier'], None), 'slash_oversize'),
})
# 2.23: three more bosses for every theme (a year is about eighty dungeons, so 78 bosses before one comes back Reborn)
FE = H + 'human/heads_human_female_elderly.json'
MOBS.update({
    'lich': ('male', [(SKEL, None), (H + 'undead/heads_skeleton.json', None), (I['tatters'], 'purple'), (I['crown'], 'crown_gray')], 'spellcast', None, None),
    'ghoulking': ('male', [(ZOMB, 'zombie'), (H + 'undead/heads_zombie.json', 'zombie'), (I['plate'], 'iron'), (I['crown'], 'black')], 'slash', (I['w_mace'], None), 'slash_oversize'),
    'widow': ('female', hum('female', 'porcelain', FE, ('robe', 'black'), ('hood', 'black')), 'spellcast', None, None),
    'warlord': ('male', hum('male', 'tan', HM, ('plate', 'steel'), ('arms_armour', None), ('legs_armour', None), ('greathelm', 'steel'), ('cape', 'red')), 'thrust', (I['w_halberd'], None), 'thrust_oversize'),
    'smuggler': ('female', hum('female', 'tan', HF, ('frock', 'brown'), ('pants', 'charcoal'), ('tricorne', 'brown'), ('hair_ponytail', 'chestnut')), 'slash', (I['w_saber'], None), 'slash_oversize'),
    'oldfang': ('muscular', [(BODY, 'fur_grey'), (H + 'beast/heads_wolf_male.json', 'fur_grey'), (I['leather'], 'black'), (I['pants'], 'black')], 'slash', (I['w_waraxe'], None), 'slash_oversize'),
    'icebull': ('muscular', [(BODY, 'fur_white'), (H + 'beast/heads_minotaur.json', 'fur_white'), (I['pants'], 'sky'), (I['pauldrons'], 'silver')], 'slash', (I['w_mace'], None), 'slash_oversize'),
    'jarl': ('male', hum('male', 'light', HM, ('plate', 'steel'), ('cape', 'white'), ('beard_bushy', 'platinum'), ('crown', 'silver')), 'slash', (I['w_longsword'], None), 'slash_oversize'),
    'revenant': ('male', [(SKEL, None), (H + 'undead/heads_skeleton.json', None), (I['mail'], 'steel'), (I['armet'], 'steel'), (I['cape'], 'sky')], 'slash', (I['w_longsword'], None), 'slash_oversize'),
    'moonwolf': ('male', [(BODY, 'fur_black'), (H + 'beast/heads_wolf_male.json', 'fur_black'), (I['cape'], 'navy'), (I['pants'], 'navy')], 'slash', None, None),
    'harequeen': ('female', [(BODY, 'fur_white'), (H + 'farm/heads_rabbit.json', 'fur_white'), (I['robe'], 'forest green'), (I['tiara'], 'tiara_silver')], 'spellcast', None, None),
    'greenknight': ('male', hum('male', 'green', HM, ('plate', 'bronze'), ('arms_armour', None), ('legs_armour', None), ('cape', 'forest'), ('beard_bushy', 'green')), 'slash', (I['w_waraxe'], None), 'slash_oversize'),
    'marshqueen': ('female', [(BODY, 'dark_green'), (H + 'reptile/heads_lizard_female.json', 'dark_green'), (I['robe'], 'dark brown'), (I['tiara'], 'tiara_gold')], 'spellcast', None, None),
    'bogtroll': ('muscular', [(BODY, 'olive'), (H + 'fantasy/heads_troll.json', 'olive'), (I['pants'], 'walnut'), (I['belt'], 'leather')], 'slash', (I['w_mace'], None), 'slash_oversize'),
    'mudman': ('male', [(ZOMB, 'zombie'), (H + 'undead/heads_zombie.json', 'zombie'), (I['tatters'], 'brown'), (I['pants'], 'walnut')], 'slash', None, None),
    'surgeon': ('male', hum('male', 'ivory', H + 'human/heads_human_male_gaunt.json', ('apron', 'white'), ('lsleeve', 'white'), ('pants', 'white'), ('mask', 'white')), 'slash', (I['w_dagger'], 'dagger'), None),
    'pigking': ('muscular', [(BODY, 'peach'), (H + 'farm/heads_pig.json', 'peach'), (I['cape'], 'red'), (I['crown'], 'crown_gold'), (I['pants'], 'maroon')], 'slash', (I['w_mace'], None), 'slash_oversize'),
    'sistermercy': ('female', hum('female', 'ivory', FE, ('robe', 'white'), ('hood', 'black')), 'spellcast', None, None),
    'brassbull': ('muscular', [(BODY, 'fur_copper'), (H + 'beast/heads_minotaur.json', 'fur_copper'), (I['plate'], 'brass'), (I['pants'], 'black')], 'slash', (I['w_waraxe'], None), 'slash_oversize'),
    'anvilmother': ('female', hum('female', 'coffee', HF, ('leather', 'black'), ('pants', 'black'), ('hair_ponytail', 'ginger')), 'slash', (I['w_mace'], None), 'slash_oversize'),
    'ashking': ('male', [(SKEL, None), (H + 'undead/heads_skeleton.json', None), (I['plate'], 'brass'), (I['crown'], 'crown_red'), (I['cape'], 'orange')], 'slash', (I['w_longsword'], None), 'slash_oversize'),
    'orcqueen': ('female', [(BODY, 'dark_green'), (H + 'fantasy/heads_orc_female.json', 'dark_green'), (I['plate'], 'bronze'), (I['crown'], 'crown_gold'), (I['cape'], 'maroon')], 'thrust', (I['w_spear'], 'dark'), None),
    'goblinseer': ('male', [(BODY, 'pale_green'), (H + 'fantasy/heads_goblin.json', 'pale_green'), (I['lsleeve'], 'purple'), (I['skirt'], 'purple'), (I['hood'], 'purple')], 'spellcast', None, None),
    'trollking': ('muscular', [(BODY, 'green'), (H + 'fantasy/heads_troll.json', 'green'), (I['pauldrons'], 'iron'), (I['crown'], 'crown_gray'), (I['pants'], 'brown')], 'slash', (I['w_mace'], None), 'slash_oversize'),
    'drownedking': ('male', [(ZOMB, 'zombie'), (H + 'undead/heads_zombie.json', 'zombie'), (I['frock'], 'teal'), (I['crown'], 'crown_gold'), (I['cape'], 'navy')], 'thrust', (I['w_spear'], 'dark'), None),
    'dreadcaptain': ('female', [(SKEL, None), (H + 'undead/heads_skeleton.json', None), (I['frock'], 'maroon'), (I['tricorne'], 'black')], 'slash', (I['w_saber'], None), 'slash_oversize'),
    'deepone': ('male', [(BODY, 'blue'), (H + 'reptile/heads_lizard_male.json', 'blue'), (I['tatters'], 'teal'), (I['pants'], 'navy')], 'thrust', (I['w_spear'], 'light'), None),
    'warden': ('male', hum('male', 'light', HM, ('plate', 'iron'), ('arms_armour', None), ('barbuta', 'iron'), ('tabard', 'maroon')), 'slash', (I['w_mace'], None), 'slash_oversize'),
    'deathknight': ('male', [(SKEL, None), (H + 'undead/heads_skeleton.json', None), (I['plate'], 'iron'), (I['greathelm'], 'iron'), (I['cape'], 'black')], 'slash', (I['w_longsword'], None), 'slash_oversize'),
    'ironqueen': ('female', hum('female', 'porcelain', HF, ('robe', 'purple'), ('tiara', 'tiara_silver'), ('hair_long', 'raven'), ('cape', 'black')), 'spellcast', None, None),
    'stormlord': ('male', hum('male', 'lavender', HM, ('lsleeve', 'blue'), ('skirt', 'blue'), ('cape', 'sky'), ('crown', 'silver'), ('beard_bushy', 'white')), 'thrust', (I['w_gnarled'], 'dark'), 'thrust_oversize'),
    'clockknight': ('male', hum('male', 'light', HM, ('plate', 'copper'), ('arms_armour', None), ('legs_armour', None), ('armet', 'copper')), 'thrust', (I['w_halberd'], None), 'thrust_oversize'),
    'ladythunder': ('female', hum('female', 'light', HF, ('robe', 'blue'), ('tiara', 'tiara_silver'), ('hair_long', 'platinum')), 'spellcast', None, None),
    'ghostbride': ('female', hum('female', 'porcelain', HF, ('robe', 'white'), ('tiara', 'tiara_silver'), ('hair_long', 'white')), 'spellcast', None, None),
    'werewolf': ('muscular', [(BODY, 'fur_brown'), (H + 'beast/heads_wolf_male.json', 'fur_brown'), (I['pants'], 'charcoal')], 'slash', None, None),
    'butler': ('male', hum('male', 'porcelain', H + 'human/heads_human_male_gaunt.json', ('frock', 'black'), ('pants', 'black'), ('shirt_l', 'white')), 'slash', (I['w_dagger'], 'dagger'), None),
    'archbishop': ('male', hum('male', 'light', H + 'human/heads_human_male_elderly.json', ('lsleeve', 'white'), ('skirt', 'white'), ('cape', 'yellow'), ('crown', 'crown_gold')), 'spellcast', None, None),
    'goldpaladin': ('male', hum('male', 'light', HM, ('plate', 'gold'), ('arms_armour', None), ('legs_armour', None), ('greathelm', 'gold'), ('cape', 'white')), 'slash', (I['w_longsword'], None), 'slash_oversize'),
    'martyr': ('female', hum('female', 'ivory', HF, ('robe', 'white'), ('hood', 'white')), 'spellcast', None, None),
})

# ---------- small beasts, by hand (facing left) ----------
BEASTS = {
    'rat': ({'b': (58, 48, 46), 'B': (110, 94, 86), 'l': (170, 150, 140), 'e': (230, 40, 40), 'n': (240, 150, 160), 't': (200, 140, 150)}, [
        ["..................", "......bbbbb.......", "....bBBBBBBBb.....", "..ebBBBBBBBBBb....", "nbBBBBBBBBBBBBbttt", "..bBllllllllBb...t", "...b.b....b.b.....", ".................."],
        ["..................", "......bbbbb.......", "....bBBBBBBBb.....", "..ebBBBBBBBBBb...t", "nbBBBBBBBBBBBBbtt.", "..bBllllllllBb....", "....b.b..b.b......", ".................."]]),
    'leech': ({'d': (40, 30, 34), 'D': (86, 62, 70), 'h': (130, 96, 104), 'm': (200, 60, 80)}, [
        ["................", "....dddddd......", "..dDDDDDDDDdd...", ".mDDhDDhDDhDDd..", "..dDDDDDDDDDDDd.", "....dddddddddd..", "................"],
        ["................", "......ddddd.....", "....dDDDDDDDd...", "..mDDhDDhDDDDd..", "...dDDDDDDDDDd..", ".....ddddddd....", "................"]]),
    'wisp': ({'w': (150, 190, 210), 'W': (220, 240, 250), 'e': (30, 40, 60), 'o': (60, 80, 110)}, [
        ["......w.......", ".....wWw......", "....wWWWw.....", "...wWWWWWw....", "..wWWeWWeWw...", "..wWWWWWWWw...", "..wWWWooWWw...", "..wWWWWWWWw...", "...wWWWWWw....", "...wW.wW.w....", "....w..w......"],
        [".......w......", "......wWw.....", "....wWWWWw....", "...wWWWWWWw...", "..wWWeWWeWw...", "..wWWWWWWWw...", "..wWWWooWWw...", "..wWWWWWWWw...", "...wWWWWWw....", "....wW.wWw....", "...w...w......"]]),
    'crab': ({'c': (110, 30, 24), 'C': (200, 70, 50), 'e': (20, 20, 20)}, [
        ["..cc..........cc..", ".cCCc........cCCc.", ".cCCc..e..e..cCCc.", "..cc.cCCCCCCc.cc..", "...ccCCCCCCCCcc...", "....cCCCCCCCCc....", "...c.c.c..c.c.c...", ".................."],
        [".cc............cc.", "cCCc..........cCCc", ".cCCc..e..e..cCCc.", "..cc.cCCCCCCc.cc..", "...ccCCCCCCCCcc...", "....cCCCCCCCCc....", "....c.c.cc.c.c....", ".................."]]),
    'kite': ({'y': (90, 150, 210), 'Y': (190, 230, 255), 't': (230, 230, 140)}, [
        ["......y.......", ".....yYy......", "....yYYYy.....", "...yYYYYYy....", "..yYYYYYYYy...", "...yYYYYYy....", "....yYYYy.....", ".....yYy......", "......y.......", "......t.......", ".....t........", "......t.......", ".......t......"],
        [".......y......", "......yYy.....", ".....yYYYy....", "....yYYYYYy...", "...yYYYYYYYy..", "....yYYYYYy...", ".....yYYYy....", "......yYy.....", ".......y......", ".......t......", "........t.....", ".......t......", "......t......."]]),
}


def pixmap(pal, rows):
    w, h = max(len(r) for r in rows), len(rows)
    im = Image.new('RGBA', (w, h))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in pal:
                im.putpixel((x, y), pal[ch] + (255,))
    return im


def outline(im):
    w, h = im.size
    o = Image.new('RGBA', (w + 2, h + 2))
    a = im.split()[3]
    for dx, dy in ((0, 1), (2, 1), (1, 0), (1, 2)):
        o.paste((20, 14, 18, 255), (dx, dy), a)
    o.alpha_composite(im, (1, 1))
    return o


# ---------- dungeon props, by hand ----------
def props():
    P = {}
    # a fountain: a stone basin with a spout and dark water
    im = Image.new('RGBA', (34, 36)); d = ImageDraw.Draw(im)
    d.rectangle((14, 2, 19, 20), fill=(110, 106, 112)); d.rectangle((14, 2, 15, 20), fill=(140, 136, 142))
    d.ellipse((2, 14, 31, 34), fill=(84, 80, 88)); d.ellipse((4, 15, 29, 29), fill=(120, 116, 124)); d.ellipse((7, 17, 26, 27), fill=(40, 60, 80))
    d.line((16, 6, 16, 18), fill=(120, 170, 210)); d.point((12, 21), fill=(170, 210, 240)); d.point((21, 23), fill=(170, 210, 240))
    P['fountain'] = outline(im)
    # a pressure plate, and the blades it springs
    im = Image.new('RGBA', (30, 30)); d = ImageDraw.Draw(im)
    d.rectangle((2, 2, 27, 27), fill=(70, 66, 70)); d.rectangle((4, 4, 25, 25), fill=(96, 92, 96)); d.line((4, 15, 25, 15), fill=(60, 56, 60)); d.line((15, 4, 15, 25), fill=(60, 56, 60))
    P['plate'] = im
    im = Image.new('RGBA', (30, 22)); d = ImageDraw.Draw(im)
    for x in range(1, 29, 6):
        d.polygon([(x, 21), (x + 2, 1), (x + 4, 21)], fill=(190, 194, 204)); d.line((x + 2, 2, x + 2, 20), fill=(240, 244, 250))
    P['spikes'] = outline(im)
    # bones
    im = Image.new('RGBA', (22, 10)); d = ImageDraw.Draw(im)
    W = (226, 220, 200)
    d.line((2, 7, 14, 4), fill=W, width=2); d.ellipse((0, 5, 3, 8), fill=W); d.ellipse((13, 2, 16, 5), fill=W)
    d.ellipse((14, 3, 21, 9), fill=W); d.point((16, 6), fill=(40, 30, 30)); d.point((19, 6), fill=(40, 30, 30))
    P['bones'] = outline(im)
    # stairs down
    im = Image.new('RGBA', (40, 44)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 39, 43), fill=(30, 26, 30))
    for i in range(6):
        y = 4 + i * 7; c = 110 - i * 14
        d.rectangle((3 + i, y, 36 - i, y + 5), fill=(c, c - 4, c + 2)); d.line((3 + i, y, 36 - i, y), fill=(c + 30, c + 26, c + 32))
    P['stairs'] = outline(im)
    # an altar for the boss
    im = Image.new('RGBA', (52, 34)); d = ImageDraw.Draw(im)
    d.rectangle((4, 12, 47, 31), fill=(86, 82, 90)); d.rectangle((2, 8, 49, 14), fill=(124, 120, 128)); d.rectangle((2, 8, 49, 9), fill=(160, 156, 164))
    d.rectangle((20, 8, 31, 31), fill=(120, 30, 40)); d.rectangle((22, 8, 29, 31), fill=(150, 44, 54))
    d.rectangle((8, 2, 10, 8), fill=(220, 210, 170)); d.rectangle((41, 2, 43, 8), fill=(220, 210, 170)); d.point((9, 1), fill=(255, 200, 80)); d.point((42, 1), fill=(255, 200, 80))
    P['altar'] = outline(im)
    # a crack in the wall (secrets)
    im = Image.new('RGBA', (16, 30)); d = ImageDraw.Draw(im)
    d.line([(8, 0), (6, 6), (9, 12), (5, 19), (8, 24), (7, 29)], fill=(20, 16, 20), width=2); d.line([(9, 12), (13, 15)], fill=(20, 16, 20)); d.line([(5, 19), (2, 21)], fill=(20, 16, 20))
    P['crack'] = im
    # a flask
    im = Image.new('RGBA', (8, 11)); d = ImageDraw.Draw(im)
    d.rectangle((3, 0, 4, 2), fill=(150, 110, 70)); d.ellipse((0, 2, 7, 10), fill=(200, 40, 50)); d.point((2, 4), fill=(255, 180, 180))
    P['flask'] = outline(im)
    # gold
    im = Image.new('RGBA', (12, 8)); d = ImageDraw.Draw(im)
    for x, y in ((1, 4), (5, 3), (8, 4), (3, 1), (6, 0)):
        d.ellipse((x, y, x + 3, y + 3), fill=(230, 180, 50)); d.point((x + 1, y + 1), fill=(255, 240, 160))
    P['gold'] = outline(im)
    return P


def crop_strip(strip, n, fw, fh):
    """Crop every frame of a strip to the union of their boxes. Returns (image n*w wide, w, h, ox, oy)."""
    x0, y0, x1, y1 = fw, fh, 0, 0
    for i in range(n):
        bb = strip.crop((i * fw, 0, i * fw + fw, fh)).getbbox()
        if bb:
            x0, y0, x1, y1 = min(x0, bb[0]), min(y0, bb[1]), max(x1, bb[2]), max(y1, bb[3])
    if x1 <= x0:
        x0, y0, x1, y1 = 0, 0, 1, 1
    w, h = x1 - x0, y1 - y0
    out = Image.new('RGBA', (n * w, h))
    for i in range(n):
        out.alpha_composite(strip.crop((i * fw + x0, y0, i * fw + x1, y1)), (i * w, 0))
    return out, w, h, x0, y0


def main():
    # 2.22: no walk strip (the crawl never drew it), and every strip cropped to what its frames use, then shelf-packed.
    # A strip's box is [x, y, frames, w, h, ox, oy, size]: (ox, oy) is where the crop sits in its size x size frame.
    strips = []   # (key, part, image, meta)
    meta = {}
    for name, (body, parts, atk, weapon, ca) in MOBS.items():
        wp = parts + ([weapon] if weapon else [])
        idle = row_strip(wp, body, 'idle', LEFT)
        if idle.getbbox() is None:
            idle = row_strip(wp, body, 'walk', LEFT).crop((0, 0, 128, 64))
        hurt = row_strip(wp, body, 'hurt', 0)
        at, size = attack_strip(parts, body, atk, weapon, ca)
        meta[name] = {'lpc': 2, 'atkAnim': atk}
        for part, im, n, fs in (('idle', idle, 2, 64), ('hurt', hurt, 6, 64), ('atk', at, at.width // size, size)):
            c, w, h, ox, oy = crop_strip(im, n, fs, fs)
            strips.append((name, part, c, [n, w, h, ox, oy, fs]))
    beasts = {k: [outline(pixmap(pal, fr)) for fr in frames] for k, (pal, frames) in BEASTS.items()}
    P = props()
    for k, frs in list(beasts.items()) + [(k, [im]) for k, im in P.items()]:
        for i, im in enumerate(frs):
            strips.append((k, i, im, None))
    W = 2048
    strips.sort(key=lambda t: -t[2].height)
    sheet = Image.new('RGBA', (W, 16000))
    x = y = rowh = 0
    for k, part, im, m in strips:
        if x + im.width > W:
            x, y, rowh = 0, y + rowh + 1, 0
        sheet.alpha_composite(im, (x, y))
        if m is None:
            meta.setdefault(k, {'px': 1, 'frames': []})['frames'].append([x, y, im.width, im.height, part])
        else:
            meta[k][part] = [x, y] + m
        x += im.width + 1; rowh = max(rowh, im.height)
    y += rowh + 1
    for k, v in meta.items():   # beast frames back in their own order
        if v.get('px'):
            v['frames'] = [f[:4] for f in sorted(v['frames'], key=lambda f: f[4])]
    sheet = sheet.crop((0, 0, W, y))
    sheet.save(os.path.join(OUT, 'delve.png'), optimize=True)
    json.dump(meta, open(os.path.join(OUT, 'delve.json'), 'w'), separators=(',', ':'))
    print('delve atlas', sheet.size, round(sheet.size[0] * sheet.size[1] * 4 / 1e6, 1), 'MB decoded', os.path.getsize(os.path.join(OUT, 'delve.png')) // 1024, 'KB,', len(meta), 'entries')


if __name__ == '__main__':
    main()

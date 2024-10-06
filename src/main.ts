import * as THREE from 'three';
import gsap from 'gsap';
import imagesLoaded from 'imagesloaded';

import './style.css';

const displacementSlider = function (opts: {
  parent: any;
  images: any;
  displacementImage: any;
  angle?: number;
  intensity: any;
  angle1?: any;
  angle2?: any;
  speedIn?: any;
  speed?: any;
  speedOut?: any;
}) {
  let speed = 1.6;
  let vertex = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `;

  let fragment = `
        
        varying vec2 vUv;

        uniform sampler2D currentImage;
        uniform sampler2D nextImage;

        uniform float dispFactor;

        void main() {

            vec2 uv = vUv;
            vec4 _currentImage;
            vec4 _nextImage;
            float intensity = 0.3;

            vec4 orig1 = texture2D(currentImage, uv);
            vec4 orig2 = texture2D(nextImage, uv);
            
            _currentImage = texture2D(currentImage, vec2(uv.x, uv.y + dispFactor * (orig2 * intensity)));

            _nextImage = texture2D(nextImage, vec2(uv.x, uv.y + (1.0 - dispFactor) * (orig1 * intensity)));

            vec4 finalTexture = mix(_currentImage, _nextImage, dispFactor);

            gl_FragColor = finalTexture;

        }
    `;

  fragment = `
varying vec2 vUv;

uniform float dispFactor;
uniform float dpr;
uniform sampler2D disp;

uniform sampler2D currentImage;
uniform sampler2D nextImage;
uniform float angle1;
uniform float angle2;
uniform float intensity1;
uniform float intensity2;
uniform vec4 res;
uniform vec2 parent;

mat2 getRotM(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec4 disp = texture2D(disp, vUv);
  vec2 dispVec = vec2(disp.r, disp.g);

  vec2 uv = 0.5 * gl_FragCoord.xy / (res.xy) ;
  vec2 myUV = (uv - vec2(0.5))*res.zw + vec2(0.5);


  vec2 distortedPosition1 = myUV + getRotM(angle1) * dispVec * intensity1 * dispFactor;
  vec2 distortedPosition2 = myUV + getRotM(angle2) * dispVec * intensity2 * (1.0 - dispFactor);
  vec4 _currentImage = texture2D(currentImage, distortedPosition1);
  vec4 _nextImage = texture2D(nextImage, distortedPosition2);
  gl_FragColor = mix(_currentImage, _nextImage, dispFactor);
}
`;

  let images = opts.images,
    image,
    sliderImages: any[] = [];
  let canvasWidth = images[0].clientWidth;
  // let canvasHeight = images[0].clientHeight;
  let parent = opts.parent;

  let dispImage = opts.displacementImage;
  var intensity1 = opts.intensity || 1;
  var intensity2 = opts.intensity || 1;
  var commonAngle = 0; //opts.angle || Math.PI / 4; // 45 degrees by default, so grayscale images work correctly
  var angle1 = opts.angle1 || commonAngle;
  var angle2 = opts.angle2 || -commonAngle * 3;
  // var speedIn = opts.speedIn || opts.speed || 1.6;
  // var speedOut = opts.speedOut || opts.speed || 1.2;

  console.log(commonAngle, angle1, angle2);

  let renderWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  let renderHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

  let renderW, renderH;

  if (renderWidth > canvasWidth) {
    renderW = renderWidth;
  } else {
    renderW = canvasWidth;
  }

  // renderH = canvasHeight
  renderH = renderHeight;

  let renderer = new THREE.WebGLRenderer({
    antialias: false,
  });

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x23272a, 1.0);
  renderer.setSize(renderW, renderH);
  parent.appendChild(renderer.domElement);

  let loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';

  var disp = loader.load(dispImage);
  disp.magFilter = disp.minFilter = THREE.LinearFilter;
  disp.anisotropy = renderer.capabilities.getMaxAnisotropy();

  images.forEach((img: HTMLImageElement) => {
    image = loader.load(img.getAttribute('src') + '?v=' + Date.now());
    image.magFilter = image.minFilter = THREE.LinearFilter;
    image.anisotropy = renderer.capabilities.getMaxAnisotropy();
    sliderImages.push(image);
  });

  let scene = new THREE.Scene();
  scene.background = new THREE.Color(0x23272a);
  // let camera = new THREE.OrthographicCamera(renderWidth / -2, renderWidth / 2, renderHeight / 2, renderHeight / -2, 1, 1000);
  var camera = new THREE.OrthographicCamera(
    parent.offsetWidth / -2,
    parent.offsetWidth / 2,
    parent.offsetHeight / 2,
    parent.offsetHeight / -2,
    1,
    1000
  );

  camera.position.z = 1;

  let a1, a2;
  let imageAspect = 1;
  if (parent.offsetHeight / parent.offsetWidth < imageAspect) {
    a1 = 1;
    a2 = parent.offsetHeight / parent.offsetWidth / imageAspect;
  } else {
    a1 = (parent.offsetWidth / parent.offsetHeight) * imageAspect;
    a2 = 1;
  }

  let mat = new THREE.ShaderMaterial({
    uniforms: {
      dispFactor: {
        //type: 'f',
        value: 0.0,
      },
      currentImage: {
        //type: 't',
        value: sliderImages[0],
      },
      nextImage: {
        //type: 't',
        value: sliderImages[1],
      },
      intensity1: {
        // type: 'f',
        value: intensity1,
      },
      intensity2: {
        // type: 'f',
        value: intensity2,
      },
      angle1: {
        // type: 'f',
        value: angle1,
      },
      angle2: {
        // type: 'f',
        value: angle2,
      },
      disp: {
        // type: 't',
        value: disp,
      },
      res: {
        // type: 'vec4',
        value: new THREE.Vector4(parent.offsetWidth, parent.offsetHeight, a1, a2),
      },
      dpr: {
        // type: 'f',
        value: window.devicePixelRatio,
      },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    opacity: 1.0,
  });

  let geometry = new THREE.PlaneGeometry(parent.offsetWidth, parent.offsetHeight, 1);
  let object = new THREE.Mesh(geometry, mat);
  object.position.set(0, 0, 0);
  scene.add(object);

  let addEvents = function () {
    let pagButtons = Array.from(document.getElementById('pagination')!.querySelectorAll('button'));
    let isAnimating = false;

    pagButtons.forEach((el) => {
      el.addEventListener('click', function () {
        if (!isAnimating) {
          isAnimating = true;

          document.getElementById('pagination')!.querySelectorAll('.active')[0].className = '';
          this.className = 'active';

          let slideId = parseInt(this.dataset.slide!, 10);

          mat.uniforms.nextImage.value = sliderImages[slideId];
          // mat.uniforms.nextImage.needsUpdate = true;

          gsap.to(mat.uniforms.dispFactor, {
            value: 1,
            duration: speed,
            ease: 'Expo.easeInOut',
            onComplete: function () {
              mat.uniforms.currentImage.value = sliderImages[slideId];
              // mat.uniforms.currentImage.needsUpdate = true;
              mat.uniforms.dispFactor.value = 0.0;
              isAnimating = false;
            },
          });

          let slideTitleEl = document.getElementById('slide-title');
          let slideStatusEl = document.getElementById('slide-status');
          let nextSlideTitle = document.querySelectorAll(`[data-slide-title="${slideId}"]`)[0].innerHTML;
          let nextSlideStatus = document.querySelectorAll(`[data-slide-status="${slideId}"]`)[0].innerHTML;

          gsap.fromTo(
            slideTitleEl,
            0.5,
            {
              autoAlpha: 1,
              y: 0,
            },
            {
              autoAlpha: 0,
              y: 20,
              ease: 'Expo.easeIn',
              onComplete: function () {
                slideTitleEl!.innerHTML = nextSlideTitle;

                gsap.to(slideTitleEl, 0.5, {
                  autoAlpha: 1,
                  y: 0,
                });
              },
            }
          );

          gsap.fromTo(
            slideStatusEl,
            {
              autoAlpha: 1,
              y: 0,
            },
            {
              duration: 0.5,
              autoAlpha: 0,
              y: 20,
              ease: 'Expo.easeIn',
              onComplete: function () {
                slideStatusEl!.innerHTML = nextSlideStatus;

                gsap.to(slideStatusEl, 0.5, {
                  autoAlpha: 1,
                  y: 0,
                  delay: 0.1,
                });
              },
            }
          );
        }
      });
    });
  };

  addEvents();

  window.addEventListener('resize', function () {
    renderer.setSize(renderW, renderH);
  });

  let animate = function () {
    requestAnimationFrame(animate);

    renderer.render(scene, camera);
  };
  animate();
};

imagesLoaded(document.querySelectorAll('img'), () => {
  document.body.classList.remove('loading');
  console.log('aaaa');

  const el = document.getElementById('slider');
  const imgs = Array.from(el!.querySelectorAll('img'));

  displacementSlider({
    parent: el,
    images: imgs,
    displacementImage: '/public/testDistort.png',
    angle: 0,
    intensity: 0.1,
  });
});
